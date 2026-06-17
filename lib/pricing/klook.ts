/**
 * Klook — Affiliate API
 * Docs: https://affiliate.klook.com/
 * Env:  KLOOK_API_KEY, KLOOK_API_SECRET
 */

import { registerFetcher, usdToInr } from './registry';
import { TripPricingContext } from './context';

registerFetcher('Klook', async (ctx: TripPricingContext) => {
  const apiKey    = process.env.KLOOK_API_KEY;
  const apiSecret = process.env.KLOOK_API_SECRET;
  if (!apiKey || !apiSecret) return null;

  const { destination, startDate } = ctx;

  const params = new URLSearchParams({
    keyword:  destination,
    page:     '1',
    pageSize: '1',
    currency: 'USD',
    ...(startDate && { startDate }),
  });

  const res = await fetch(
    `https://affiliate.klook.com/api/activities/search?${params}`,
    {
      headers: {
        'X-API-KEY':    apiKey,
        'X-API-SECRET': apiSecret,
        'Accept':       'application/json',
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const activity = data?.data?.activities?.[0];
  if (!activity) return null;

  const priceUsd = activity.price ?? activity.from_price;
  if (!priceUsd) return null;

  return {
    title:    activity.title ?? 'Top Experience',
    price:    usdToInr(Number(priceUsd)),
    currency: 'INR',
  };
});
