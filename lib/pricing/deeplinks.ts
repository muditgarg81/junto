import { TripPricingContext } from './context';

/**
 * Pre-fills partner deep links with trip dates, destination, and traveler count
 * so users land on a filtered results page rather than the partner homepage.
 */
export function buildDeepLink(
  partnerName: string,
  baseLink: string,
  ctx: TripPricingContext
): string {
  const { destination, startDate, endDate, travelers, countryCode } = ctx;
  const dest = encodeURIComponent(destination);
  const start = startDate ?? '';
  const end = endDate ?? '';

  switch (partnerName) {
    case 'GetYourGuide':
      return buildQS(baseLink, {
        q: destination,
        ...(start && { date: start }),
        ...(travelers > 1 && { adults: travelers }),
      });

    case 'Klook':
      return buildQS(baseLink, {
        keyword: destination,
        ...(start && { startDate: start }),
        ...(travelers > 1 && { quantity: travelers }),
      });

    case 'Viator':
      return buildQS(baseLink, {
        ...(start && { startDate: start }),
        ...(end   && { endDate:   end   }),
        ...(travelers > 1 && { paxCount: travelers }),
      });

    case 'Tiqets':
      return buildQS(baseLink, {
        q: destination,
        ...(start && { date: start }),
      });

    case 'TicketNetwork':
      return buildQS(baseLink, {
        q: destination,
        ...(start && { eventDate: start }),
      });

    case 'Kiwitaxi':
      // Kiwitaxi link already encodes route; append date + pax
      return buildQS(baseLink, {
        ...(start      && { date:       start      }),
        ...(travelers  && { passengers: travelers  }),
      });

    case 'Welcome Pickups':
      return buildQS(baseLink, {
        destination,
        ...(start     && { date:       start     }),
        ...(travelers && { passengers: travelers }),
      });

    case 'GetRentaCar':
      return buildQS(baseLink, {
        city: destination,
        ...(start && { dateFrom: start }),
        ...(end   && { dateTo:   end   }),
        ...(travelers > 1 && { seats: travelers }),
      });

    case 'BikesBooking':
      return buildQS(baseLink, {
        location: destination,
        ...(start && { from: start }),
        ...(end   && { to:   end   }),
      });

    case 'Airalo':
      // Airalo uses country code for package filtering
      return buildQS(baseLink, {
        ...(countryCode && { country: countryCode }),
        ...(start       && { startDate: start     }),
      });

    case 'Yesim':
      return buildQS(baseLink, {
        ...(countryCode && { country: countryCode }),
      });

    case 'BookMyForex':
    case 'AirHelp':
    case 'VisitorsCoverage':
      // These partners have form-based flows — just pass destination where supported
      return buildQS(baseLink, {
        destination,
        ...(start && { startDate: start }),
        ...(end   && { endDate:   end   }),
        ...(travelers > 1 && { travelers }),
      });

    default:
      // Generic fallback — append whatever we have
      return buildQS(baseLink, {
        destination,
        ...(start && { startDate: start }),
        ...(end   && { endDate: end }),
      });
  }
}

/** Appends query params to a URL, preserving existing params. */
function buildQS(base: string, params: Record<string, string | number>): string {
  // Don't touch the {sub} placeholder — it gets resolved at click time
  const subPlaceholder = '{sub}';
  const sanitized = base.replace(subPlaceholder, '__SUB__');
  try {
    const url = new URL(sanitized);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString().replace('__SUB__', subPlaceholder);
  } catch {
    // base is a relative or malformed URL — just return as-is
    return base;
  }
}
