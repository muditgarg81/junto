import { TripPricingContext } from './context';
import { LivePrice, getFetcher } from './registry';

export type { LivePrice };
export { usdToInr, registerFetcher } from './registry';

// Side-effect imports — each calls registerFetcher() on load.
import './gyg';
import './viator';
import './airalo';
import './klook';
import './kiwitaxi';
import './visitorscoverage';
import './saily';

async function withTimeout(
  fetcher: (ctx: TripPricingContext) => Promise<LivePrice | null>,
  ctx: TripPricingContext,
  partnerName: string
): Promise<LivePrice | null> {
  try {
    return await Promise.race([
      fetcher(ctx),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
  } catch (err) {
    console.warn(`PriceFetcher[${partnerName}]: failed —`, (err as Error).message);
    return null;
  }
}

export async function fetchLivePrice(
  partnerName: string,
  ctx: TripPricingContext
): Promise<LivePrice | null> {
  const fetcher = getFetcher(partnerName);
  if (!fetcher) return null;
  return withTimeout(fetcher, ctx, partnerName);
}
