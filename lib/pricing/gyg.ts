/**
 * GetYourGuide — Activities Search API
 * Docs: https://partner.getyourguide.com/en/content-api
 * Env:  GYG_API_KEY  (request at partner.getyourguide.com → API access)
 *       GYG_PARTNER_ID  (your affiliate partner ID — already known: VTHTCXI)
 */

import { registerFetcher } from './fetcher';
import { TripPricingContext } from './context';
import { usdToInr } from './fetcher';

registerFetcher('GetYourGuide', async (ctx: TripPricingContext) => {
  const apiKey = process.env.GYG_API_KEY;
  if (!apiKey) return null;

  const { destination, startDate, travelers } = ctx;

  const params = new URLSearchParams({
    q:          destination,
    limit:      '1',
    sort_by:    'popularity',
    currency:   'USD',
    ...(startDate  && { date_from: startDate }),
    ...(travelers  && { adults:    String(travelers) }),
  });

  const res = await fetch(
    `https://api.getyourguide.com/1/activities?${params}`,
    {
      headers: {
        'X-Partner-Id': apiKey,
        'Accept':       'application/json',
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const activity = data?.data?.activities?.[0];
  if (!activity) return null;

  const priceUsd = activity.price?.values?.amount ?? activity.retail_price?.values?.amount;
  if (!priceUsd) return null;

  return {
    title:    activity.title ?? 'Top-Rated Tour',
    price:    usdToInr(Number(priceUsd)),
    currency: 'INR',
  };
});
