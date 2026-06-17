/**
 * Phase 2: Real-time price fetching.
 *
 * Each partner has its own fetcher in lib/pricing/<partner>.ts.
 * fetchLivePrice() tries the live fetcher with a 3s timeout,
 * then returns null on failure so the caller falls back to mock.
 *
 * USD→INR conversion uses a hardcoded approximate rate.
 * Replace with a live FX API (e.g. exchangerate-api.com) when needed.
 */

import { TripPricingContext } from './context';

export interface LivePrice {
  title: string;
  price: number;       // in INR
  currency: 'INR';
  deepLink?: string;   // pre-filled partner URL (optional override)
}

type PriceFetcher = (ctx: TripPricingContext) => Promise<LivePrice | null>;

const USD_TO_INR = 83.5; // approximate — replace with live FX when needed

export function usdToInr(usd: number): number {
  return Math.round(usd * USD_TO_INR);
}

/** Wraps a fetcher with a 3-second timeout. Returns null on timeout/error. */
async function withTimeout(
  fetcher: PriceFetcher,
  ctx: TripPricingContext,
  partnerName: string
): Promise<LivePrice | null> {
  try {
    const result = await Promise.race([
      fetcher(ctx),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    return result;
  } catch (err) {
    console.warn(`PriceFetcher[${partnerName}]: failed —`, (err as Error).message);
    return null;
  }
}

/** Registry: partner name → fetcher function */
const FETCHERS: Record<string, PriceFetcher> = {};

/** Register a fetcher for a partner. Called by each partner module. */
export function registerFetcher(partnerName: string, fetcher: PriceFetcher) {
  FETCHERS[partnerName] = fetcher;
}

/**
 * Attempt to fetch a live price for the given partner.
 * Returns null if no fetcher is registered, env key is missing, or call fails.
 */
export async function fetchLivePrice(
  partnerName: string,
  ctx: TripPricingContext
): Promise<LivePrice | null> {
  const fetcher = FETCHERS[partnerName];
  if (!fetcher) return null;
  return withTimeout(fetcher, ctx, partnerName);
}

// ── Auto-register all partner fetchers ────────────────────────────────────
// Import side-effects register each fetcher via registerFetcher().
import './gyg';
import './viator';
import './airalo';
import './klook';
import './kiwitaxi';
import './visitorscoverage';
