'use strict';

// Maps IATA airport codes to IANA timezones so voucher flight times can be
// stored as proper instants (TIMESTAMPTZ). India-first; unknown codes default
// to Asia/Kolkata. Extend as needed — this is intentionally a focused list.

const AIRPORT_TZ: Record<string, string> = {
  // India (all Asia/Kolkata)
  DEL: 'Asia/Kolkata', BOM: 'Asia/Kolkata', BLR: 'Asia/Kolkata', MAA: 'Asia/Kolkata',
  CCU: 'Asia/Kolkata', HYD: 'Asia/Kolkata', NAG: 'Asia/Kolkata', JDH: 'Asia/Kolkata',
  GOI: 'Asia/Kolkata', GOX: 'Asia/Kolkata', COK: 'Asia/Kolkata', AMD: 'Asia/Kolkata',
  PNQ: 'Asia/Kolkata', JAI: 'Asia/Kolkata', LKO: 'Asia/Kolkata', IXC: 'Asia/Kolkata',
  ATQ: 'Asia/Kolkata', GAU: 'Asia/Kolkata', PAT: 'Asia/Kolkata', IXB: 'Asia/Kolkata',
  SXR: 'Asia/Kolkata', IXL: 'Asia/Kolkata', UDR: 'Asia/Kolkata', TRV: 'Asia/Kolkata',
  VNS: 'Asia/Kolkata', BBI: 'Asia/Kolkata', RPR: 'Asia/Kolkata', IDR: 'Asia/Kolkata',
  // Common international hubs for Indian travellers
  DXB: 'Asia/Dubai', AUH: 'Asia/Dubai', DOH: 'Asia/Qatar', SIN: 'Asia/Singapore',
  BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', KUL: 'Asia/Kuala_Lumpur', HKT: 'Asia/Bangkok',
  DPS: 'Asia/Makassar', CGK: 'Asia/Jakarta', HKG: 'Asia/Hong_Kong', NRT: 'Asia/Tokyo',
  HND: 'Asia/Tokyo', ICN: 'Asia/Seoul', KTM: 'Asia/Kathmandu', CMB: 'Asia/Colombo',
  MLE: 'Indian/Maldives', LHR: 'Europe/London', LGW: 'Europe/London', CDG: 'Europe/Paris',
  FRA: 'Europe/Berlin', AMS: 'Europe/Amsterdam', ZRH: 'Europe/Zurich', IST: 'Europe/Istanbul',
  JFK: 'America/New_York', EWR: 'America/New_York', SFO: 'America/Los_Angeles',
  LAX: 'America/Los_Angeles', ORD: 'America/Chicago', YYZ: 'America/Toronto',
  SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne',
};

const DEFAULT_TZ = 'Asia/Kolkata';

/** Look up an IANA timezone for an IATA airport code; defaults to Asia/Kolkata. */
export function airportTz(iata?: string | null): string {
  if (!iata) return DEFAULT_TZ;
  return AIRPORT_TZ[iata.trim().toUpperCase()] || DEFAULT_TZ;
}

/** Minutes that `tz` is offset from UTC at the given instant. */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  const asUTC = Date.UTC(
    +map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second
  );
  return (asUTC - instant.getTime()) / 60_000;
}

/**
 * Convert a wall-clock date+time in a given timezone to a UTC ISO string
 * suitable for a TIMESTAMPTZ column. Returns null if inputs are missing.
 */
export function localToInstantISO(
  dateStr?: string | null,
  timeStr?: string | null,
  tz: string = DEFAULT_TZ
): string | null {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  const [h, mi] = String(timeStr || '00:00').split(':').map(Number);
  // Treat the wall clock as if UTC, then correct by the tz offset at that instant.
  const utcGuess = Date.UTC(y, m - 1, d, h || 0, mi || 0);
  const offset = tzOffsetMinutes(new Date(utcGuess), tz);
  return new Date(utcGuess - offset * 60_000).toISOString();
}
