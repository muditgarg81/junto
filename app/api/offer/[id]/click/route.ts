'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getTrackingUrl } from '@/lib/offers';

/**
 * Validates that the redirect target is on an approved partner domain.
 * Returns false (and logs) if the URL is not in the allowlist.
 */
function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return false;
  try {
    const { hostname } = new URL(url);
    return allowedDomains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: offerId } = await params;

  // Derive memberId from session — never trust query params for attribution.
  let memberId = 'guest';
  try {
    const user = await getCurrentUser();
    if (user) {
      // Resolve the member row for this user within the offer's trip
      const offerCheck = await query('SELECT trip_id FROM offers WHERE id = $1', [offerId]);
      if (offerCheck.rows.length > 0) {
        const tripId = offerCheck.rows[0].trip_id;
        const memberRes = await query(
          'SELECT id FROM members WHERE trip_id = $1 AND auth_id = $2 LIMIT 1',
          [tripId, user.auth_id]
        );
        if (memberRes.rows.length > 0) memberId = memberRes.rows[0].id;
      }
    }
  } catch {
    // Non-fatal — fall back to 'guest'
  }

  let plainFallback: string | null = null;

  try {
    // 1. Fetch the offer + partner in one join to get allowed_domains
    const offerRes = await query(
      `SELECT o.*, p.allowed_domains
       FROM offers o
       LEFT JOIN partners p ON p.name = o.partner
       WHERE o.id = $1`,
      [offerId]
    );
    if (offerRes.rows.length === 0) {
      return new NextResponse('Offer Not Found', { status: 404 });
    }
    const offer = offerRes.rows[0];
    const allowedDomains: string[] = offer.allowed_domains || [];

    // 2. Build tracking URL
    const trackingUrl = getTrackingUrl(offer, memberId);
    plainFallback = trackingUrl; // used in fail-safe below

    // 3. Open-redirect guard — reject if target domain not in partner allowlist
    if (!isAllowedDomain(trackingUrl, allowedDomains)) {
      console.warn(`[click] Blocked redirect to disallowed domain: ${trackingUrl} (offerId=${offerId})`);
      // Fail safe: if no allowed domains configured yet, still redirect but log loudly
      if (allowedDomains.length === 0) {
        console.warn('[click] No allowed_domains set for partner — allowing redirect in permissive mode. Set allowed_domains to enforce.');
      } else {
        return new NextResponse('Forbidden: redirect target not in partner allowlist', { status: 403 });
      }
    }

    // 4. Build subId and log click
    const subId = `${offer.trip_id}.${offer.id}.${memberId}`;
    await query(
      `INSERT INTO offer_clicks (id, offer_id, member_id, sub_id)
       VALUES ($1, $2, $3, $4)`,
      [
        crypto.randomUUID(),
        offerId,
        memberId === 'guest' ? null : memberId,
        subId,
      ]
    );

    // 5. Advance offer status
    await query(
      "UPDATE offers SET status = 'clicked' WHERE id = $1 AND status = 'shown'",
      [offerId]
    );

    // 6. 302 redirect
    return NextResponse.redirect(trackingUrl, 302);

  } catch (err: any) {
    console.error('Error tracking offer click:', err);
    // Fail-safe: redirect to the plain URL so the user's booking flow isn't interrupted
    if (plainFallback) {
      return NextResponse.redirect(plainFallback, 302);
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
