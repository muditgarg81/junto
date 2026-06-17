/**
 * Airalo — eSIM Packages API
 * Docs: https://partners.airalo.com/docs
 * Env:  AIRALO_CLIENT_ID, AIRALO_CLIENT_SECRET
 *
 * Auth: OAuth2 client_credentials → Bearer token (cached in memory)
 */

import { registerFetcher } from './registry';
import { TripPricingContext } from './context';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const res = await fetch('https://partners.airalo.com/api/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.data?.token) return null;

  cachedToken = {
    token:     data.data.token,
    expiresAt: Date.now() + (data.data.expires_in ?? 3600) * 1000 - 60_000,
  };
  return cachedToken.token;
}

registerFetcher('Airalo', async (ctx: TripPricingContext) => {
  const clientId     = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const token = await getToken(clientId, clientSecret);
  if (!token) return null;

  const countryCode = ctx.countryCode;
  if (!countryCode || countryCode === 'IN') return null; // eSIM not needed domestically

  const params = new URLSearchParams({
    'filter[country_code]': countryCode,
    'filter[type]':         'local',
    limit:                  '1',
  });

  const res = await fetch(
    `https://partners.airalo.com/api/v2/packages?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const pkg = data?.data?.[0];
  if (!pkg) return null;

  // Airalo prices are in USD cents → convert to INR
  const priceUsd = (pkg.price ?? 0) / 100;
  const INR_RATE = 83.5;

  return {
    title:    `${pkg.data ?? '?'}GB eSIM for ${ctx.destination} (${pkg.validity ?? '?'} days)`,
    price:    Math.round(priceUsd * INR_RATE),
    currency: 'INR',
  };
});
