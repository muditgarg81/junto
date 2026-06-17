/**
 * VisitorsCoverage — Insurance Quote API
 * Docs: https://www.visitorscoverage.com/affiliate/
 * Env:  VISITORSCOVERAGE_API_KEY
 */

import { registerFetcher, usdToInr } from './registry';
import { TripPricingContext } from './context';

registerFetcher('VisitorsCoverage', async (ctx: TripPricingContext) => {
  const apiKey = process.env.VISITORSCOVERAGE_API_KEY;
  if (!apiKey) return null;

  const { destination, startDate, endDate, travelers, nights } = ctx;

  const body = {
    api_key:      apiKey,
    destination,
    travelers:    travelers ?? 2,
    trip_days:    nights,
    ...(startDate && { start_date: startDate }),
    ...(endDate   && { end_date:   endDate   }),
    coverage_type: 'comprehensive',
  };

  const res = await fetch('https://api.visitorscoverage.com/v1/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const plan = data?.plans?.[0] ?? data?.quotes?.[0];
  if (!plan) return null;

  const priceUsd = plan.premium ?? plan.price ?? plan.total;
  if (!priceUsd) return null;

  return {
    title:    `${plan.name ?? 'Group Travel Insurance'} — ${travelers ?? 2} travelers, ${nights} days`,
    price:    usdToInr(Number(priceUsd)),
    currency: 'INR',
  };
});
