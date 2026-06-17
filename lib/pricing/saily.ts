/**
 * Saily eSIM (by Nord Security) — Travelpayouts affiliate
 * No public product API; returns a mock price so the offer card shows
 * a realistic starting price. Replace with a live API if Saily exposes one.
 * Env: none required (always active for international trips)
 */

import { registerFetcher } from './registry';

registerFetcher('Saily eSIM', async (ctx) => {
  // eSIM not needed for domestic India trips
  if (!ctx.isInternational) return null;

  // Saily pricing starts around $3.50 for a basic pack → ~₹290
  // Use nights to pick a rough tier: short (<5d) ₹290, medium ₹590, long ₹990
  const nights = ctx.nights ?? 7;
  const price = nights < 5 ? 290 : nights < 14 ? 590 : 990;

  return {
    title: `Saily eSIM for ${ctx.destination} (${nights} days)`,
    price,
    currency: 'INR',
  };
});
