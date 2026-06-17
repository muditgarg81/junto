import { TripPricingContext } from './context';

export interface LivePrice {
  title: string;
  price: number;       // in INR
  currency: 'INR';
  deepLink?: string;
}

export type PriceFetcher = (ctx: TripPricingContext) => Promise<LivePrice | null>;

const USD_TO_INR = 83.5;

export function usdToInr(usd: number): number {
  return Math.round(usd * USD_TO_INR);
}

const FETCHERS: Record<string, PriceFetcher> = {};

export function registerFetcher(partnerName: string, fetcher: PriceFetcher) {
  FETCHERS[partnerName] = fetcher;
}

export function getFetcher(partnerName: string): PriceFetcher | undefined {
  return FETCHERS[partnerName];
}
