/**
 * Viator — Products Search API
 * Docs: https://docs.viator.com/partner-api/technical/
 * Env:  VIATOR_API_KEY  (request at partnerresources.viator.com)
 */

import { registerFetcher } from './fetcher';
import { TripPricingContext } from './context';
import { usdToInr } from './fetcher';

registerFetcher('Viator', async (ctx: TripPricingContext) => {
  const apiKey = process.env.VIATOR_API_KEY;
  if (!apiKey) return null;

  const { destination, startDate, endDate, travelers } = ctx;

  const body: Record<string, any> = {
    filtering: {
      destination,
    },
    sorting: {
      sort: 'TRAVELER_RATING',
      order: 'DESCENDING',
    },
    pagination: { start: 1, count: 1 },
    currency: 'USD',
  };

  if (startDate) body.filtering.lowestPrice = 0;
  if (startDate && endDate) {
    body.filtering.startDate = startDate;
    body.filtering.endDate   = endDate;
  }

  const res = await fetch('https://api.viator.com/partner/products/search', {
    method: 'POST',
    headers: {
      'exp-api-key': apiKey,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const product = data?.products?.[0];
  if (!product) return null;

  const priceUsd = product.pricing?.summary?.fromPrice;
  if (!priceUsd) return null;

  return {
    title:    product.title ?? 'Top-Rated Tour',
    price:    usdToInr(Number(priceUsd)),
    currency: 'INR',
  };
});
