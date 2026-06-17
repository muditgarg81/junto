import { query } from '@/lib/db';

export interface TripPricingContext {
  destination: string;
  startDate: string | null;   // ISO "YYYY-MM-DD"
  endDate: string | null;     // ISO "YYYY-MM-DD"
  nights: number;
  travelers: number;
  currency: string;
  isInternational: boolean;
  countryCode: string | null; // ISO 3166-1 alpha-2 e.g. "IN", "TH"
}

// Minimal city→country mapping for destinations Junto commonly sees.
// Expand as needed — this is used for eSIM country code lookups.
const CITY_TO_COUNTRY: Record<string, string> = {
  // India (domestic)
  goa: 'IN', mumbai: 'IN', delhi: 'IN', 'new delhi': 'IN', bangalore: 'IN',
  bengaluru: 'IN', hyderabad: 'IN', chennai: 'IN', kolkata: 'IN',
  jaipur: 'IN', jodhpur: 'IN', udaipur: 'IN', agra: 'IN', varanasi: 'IN',
  manali: 'IN', shimla: 'IN', leh: 'IN', ladakh: 'IN', kerala: 'IN',
  // Southeast Asia
  bangkok: 'TH', phuket: 'TH', 'chiang mai': 'TH',
  bali: 'ID', jakarta: 'ID', yogyakarta: 'ID',
  singapore: 'SG',
  kuala: 'MY', 'kuala lumpur': 'MY', penang: 'MY',
  hanoi: 'VN', 'ho chi minh': 'VN', danang: 'VN',
  manila: 'PH', cebu: 'PH',
  colombo: 'LK', kandy: 'LK',
  // Europe
  paris: 'FR', london: 'GB', rome: 'IT', milan: 'IT', venice: 'IT',
  barcelona: 'ES', madrid: 'ES', amsterdam: 'NL', berlin: 'DE',
  prague: 'CZ', vienna: 'AT', zurich: 'CH', lisbon: 'PT', athens: 'GR',
  // Middle East
  dubai: 'AE', abu: 'AE', 'abu dhabi': 'AE', doha: 'QA', riyadh: 'SA',
  // Americas
  'new york': 'US', 'los angeles': 'US', chicago: 'US', miami: 'US',
  toronto: 'CA', vancouver: 'CA',
  // East Asia
  tokyo: 'JP', osaka: 'JP', kyoto: 'JP',
  seoul: 'KR', busan: 'KR',
  'hong kong': 'HK',
  taipei: 'TW',
};

function resolveCountryCode(destination: string): string | null {
  const lower = destination.toLowerCase();
  for (const [city, code] of Object.entries(CITY_TO_COUNTRY)) {
    if (lower.includes(city)) return code;
  }
  return null;
}

function isInternationalDest(destination: string): boolean {
  const code = resolveCountryCode(destination);
  if (!code) return false; // unknown → assume domestic
  return code !== 'IN';
}

function nightsBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 3; // sensible default
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const n = Math.round(ms / (1000 * 60 * 60 * 24));
  return n > 0 ? n : 3;
}

export async function getTripPricingContext(tripId: string): Promise<TripPricingContext> {
  // 1. Dates from locked dates decision payload
  const datesRes = await query(
    `SELECT o.payload, o.label
     FROM decisions d
     JOIN options o ON d.resolved_option_id = o.id
     WHERE d.trip_id = $1 AND d.type = 'dates' AND d.status = 'locked'
     LIMIT 1`,
    [tripId]
  );

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (datesRes.rows.length > 0) {
    let payload = datesRes.rows[0].payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch {}
    }
    startDate = payload?.startDate ?? null;
    endDate   = payload?.endDate   ?? null;

    // Fallback: try to parse from label "20 Dec – 25 Dec 2026"
    if (!startDate && datesRes.rows[0].label) {
      const parsed = parseDateLabel(datesRes.rows[0].label);
      startDate = parsed.startDate;
      endDate   = parsed.endDate;
    }
  }

  // 2. Destination
  const destRes = await query(
    `SELECT o.label
     FROM decisions d
     JOIN options o ON d.resolved_option_id = o.id
     WHERE d.trip_id = $1 AND d.type = 'destination' AND d.status = 'locked'
     LIMIT 1`,
    [tripId]
  );
  const destination = destRes.rows[0]?.label || 'Goa';

  // 3. Member count
  const membersRes = await query(
    `SELECT COUNT(*) AS cnt FROM members WHERE trip_id = $1 AND status IN ('confirmed','maybe')`,
    [tripId]
  );
  const travelers = Math.max(1, parseInt(membersRes.rows[0]?.cnt ?? '1', 10));

  const countryCode    = resolveCountryCode(destination);
  const international  = isInternationalDest(destination);

  return {
    destination,
    startDate,
    endDate,
    nights:          nightsBetween(startDate, endDate),
    travelers,
    currency:        'INR',
    isInternational: international,
    countryCode,
  };
}

// Parse labels like "20 Dec – 25 Dec 2026" or "Dec 20 - Dec 25, 2026"
function parseDateLabel(label: string): { startDate: string | null; endDate: string | null } {
  const MONTHS: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };
  // Try "DD Mon YYYY – DD Mon YYYY" or "DD Mon – DD Mon YYYY"
  const parts = label.split(/[–\-]/);
  if (parts.length < 2) return { startDate: null, endDate: null };

  function toISO(s: string, fallbackYear?: string): string | null {
    const m = s.trim().match(/(\d{1,2})\s+([a-zA-Z]{3})\s*(\d{4})?/);
    if (!m) return null;
    const day = m[1].padStart(2, '0');
    const mon = MONTHS[m[2].toLowerCase()];
    const yr  = m[3] || fallbackYear || new Date().getFullYear().toString();
    if (!mon) return null;
    return `${yr}-${mon}-${day}`;
  }

  // Extract year from end part if present
  const yearMatch = parts[1].match(/\d{4}/);
  const year = yearMatch?.[0];
  return {
    startDate: toISO(parts[0], year ?? undefined),
    endDate:   toISO(parts[1]),
  };
}
