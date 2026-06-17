/**
 * Kiwitaxi — Transfer Price API
 * Docs: https://kiwitaxi.com/api
 * Env:  KIWITAXI_API_KEY
 */

import { registerFetcher, usdToInr } from './registry';
import { TripPricingContext } from './context';

registerFetcher('Kiwitaxi', async (ctx: TripPricingContext) => {
  const apiKey = process.env.KIWITAXI_API_KEY;
  if (!apiKey) return null;

  const { destination, startDate, travelers } = ctx;

  const params = new URLSearchParams({
    destination,
    api_key:    apiKey,
    passengers: String(travelers ?? 2),
    ...(startDate && { date: startDate }),
  });

  const res = await fetch(
    `https://kiwitaxi.com/api/v1/prices?${params}`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const transfer = data?.transfers?.[0] ?? data?.results?.[0];
  if (!transfer) return null;

  const priceUsd = transfer.price ?? transfer.amount;
  if (!priceUsd) return null;

  return {
    title:    `Private Transfer in ${destination}`,
    price:    usdToInr(Number(priceUsd)),
    currency: 'INR',
  };
});
