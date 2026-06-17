'use strict';

import { query } from './db';
import { Offer } from './types';
import crypto from 'crypto';
import { getTripPricingContext } from './pricing/context';
import { buildDeepLink } from './pricing/deeplinks';
import { fetchLivePrice } from './pricing/fetcher';

interface CachedPartners {
  data: any[];
  expiresAt: number;
}

let partnersCache: CachedPartners | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache TTL

/**
 * Loads active partners from the database, utilizing a 60-second in-memory cache.
 */
export async function getActivePartners(): Promise<any[]> {
  const now = Date.now();
  if (partnersCache && partnersCache.expiresAt > now) {
    return partnersCache.data;
  }

  try {
    const res = await query(
      "SELECT * FROM partners WHERE status = 'active' ORDER BY priority ASC, name ASC"
    );
    partnersCache = {
      data: res.rows,
      expiresAt: now + CACHE_TTL_MS
    };
    return res.rows;
  } catch (err) {
    console.error('Failed to load partners from DB, returning stale config if available:', err);
    return partnersCache ? partnersCache.data : [];
  }
}

/**
 * Static mock configs for offer price/title templates by category.
 */
const CATEGORY_MOCK_DEALS: Record<string, { title: string; price: number; currency: string }> = {
  hotel: { title: 'Boutique Stay near center', price: 4200, currency: 'INR' },
  activity: { title: 'Top-Rated Guided Tour', price: 2200, currency: 'INR' },
  insurance: { title: 'Full Cover Group Travel Insurance', price: 999, currency: 'INR' },
  esim: { title: 'High-Speed International eSIM Pack', price: 850, currency: 'INR' },
  forex: { title: 'Zero-Markup Forex card (Cashbacks included)', price: 500, currency: 'INR' },
  transport: { title: 'Private Airport Transfer Cab', price: 1800, currency: 'INR' },
  gear: { title: 'Premium Outdoor Gear Kit rental', price: 1500, currency: 'INR' },
  photobook: { title: 'Custom Travel Photobook Album', price: 1200, currency: 'INR' }
};

/**
 * Triggers and surfaces contextual offers for a trip based on actions/events.
 */
export async function triggerOffers(
  tripId: string,
  triggerType: 'dates_locked' | 'hotel_decision_opened' | 'flight_voucher_ingested' | 'activity_interest' | 'transport_expense',
  context?: any
) {
  try {
    console.log(`OffersEngine: Triggering for trip ${tripId} with event: ${triggerType}`);

    // 1. Fetch trip details
    const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripRes.rows.length === 0) return;

    // 2. Resolve full pricing context (destination, dates, travelers, country code)
    const pricingCtx = await getTripPricingContext(tripId);
    const { destination, isInternational } = pricingCtx;

    // 4. Fetch active partners from database cache
    const activePartners = await getActivePartners();

    // 5. Filter partners by matching surface triggers
    const matchingPartners = activePartners.filter(partner => 
      partner.surface_triggers && partner.surface_triggers.includes(triggerType)
    );

    for (const partner of matchingPartners) {
      const cat = partner.category;

      // Per-partner overrides — realistic price bands per platform
      const PARTNER_OVERRIDES: Record<string, Partial<{ title: string; price: number; currency: string }>> = {
        'GetYourGuide':     { price: 1899 },
        'Klook':            { price: 1499 },
        'Viator':           { price: 2499 },
        'Tiqets':           { price: 1699 },
        'TicketNetwork':    { price: 2199 },
        'Kiwitaxi':         { price: 1650 },
        'Welcome Pickups':  { price: 2100 },
        'GetRentaCar':      { price: 2800 },
        'BikesBooking':     { price: 750  },
        'Booking.com':      { price: 0    }, // declined — kept as guard in case row exists
        'Airalo':           { price: 699  },
        'Yesim':            { price: 599  },
        'BookMyForex':      { price: 0    },
        'VisitorsCoverage': { price: 1199 },
        'AirHelp':          { price: 0    },
      };

      // Try live price first; fall back to mock on failure/missing API key
      const livePrice = await fetchLivePrice(partner.name, pricingCtx);

      let deal = livePrice
        ? { title: livePrice.title, price: livePrice.price, currency: livePrice.currency }
        : { ...CATEGORY_MOCK_DEALS[cat] || { title: 'Special Booking Deal', price: 1000, currency: 'INR' } };

      // Static overrides for partners with no live API (AirHelp, BookMyForex etc.)
      if (!livePrice) {
        if (partner.name.toLowerCase() === 'airhelp') {
          deal = { title: 'Delayed Flight Compensation Claim (Up to ₹55,000)', price: 0, currency: 'INR' };
        }
        const override = PARTNER_OVERRIDES[partner.name];
        if (override) Object.assign(deal, override);
      }

      const isLive = !!livePrice;
      const displayTitle = isLive
        ? `${partner.name} - ${deal.title}`
        : `${partner.name} - ${deal.title} in ${destination}`;
      
      // Build pre-filled deep link with trip dates + destination + traveler count
      const baseLink = partner.link_template.replace('{id}', encodeURIComponent(destination));
      let unresolvedDeepLink = buildDeepLink(partner.name, baseLink, pricingCtx);
      // Ensure {sub} attribution placeholder is present
      if (!unresolvedDeepLink.includes('{sub}')) {
        const separator = unresolvedDeepLink.includes('?') ? '&' : '?';
        unresolvedDeepLink = `${unresolvedDeepLink}${separator}${partner.sub_param}={sub}`;
      }

      // Check if offer already surfaced to prevent spam
      const existsRes = await query(
        "SELECT 1 FROM offers WHERE trip_id = $1 AND category = $2 AND partner = $3 LIMIT 1",
        [tripId, cat, partner.name]
      );
      if (existsRes.rows.length > 0) continue;

      const offerId = crypto.randomUUID();
      const commissionEst = (Number(deal.price) * Number(partner.commission_estimate)) / 100;

      await query(
        `INSERT INTO offers (id, trip_id, category, partner, title, price, currency, deep_link, commission_estimate, surfaced_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          offerId,
          tripId,
          cat,
          partner.name,
          displayTitle,
          deal.price,
          deal.currency,
          unresolvedDeepLink,
          commissionEst,
          triggerType
        ]
      );

      console.log(`OffersEngine: Surfaced ${isLive ? 'LIVE' : 'mock'} offer "${displayTitle}" [${cat}]`);
    }
  } catch (err) {
    console.error('OffersEngine execution failed:', err);
  }
}

/**
 * Dynamically resolves the tracking deep link for a user click.
 */
export function getTrackingUrl(offer: Offer, memberId: string): string {
  const subId = `${offer.trip_id}.${offer.id}.${memberId || 'guest'}`;
  // Replace {sub} with the resolved tracking subId
  return offer.deep_link.replace('{sub}', encodeURIComponent(subId));
}
