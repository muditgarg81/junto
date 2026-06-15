'use strict';

import { ItineraryItem } from './types';
import { complete } from './llm';

export interface LLMItineraryFlag {
  itemId: string | null;
  severity: 'info' | 'warn' | 'risk';
  issue: string;
  suggestion: string;
}

export async function auditItineraryWithLLM(
  items: ItineraryItem[],
  startDateStr?: string,
  endDateStr?: string,
  weatherForecast?: string,
  advisories?: string
): Promise<LLMItineraryFlag[]> {
  try {
    const serializedItems = items.map(item => ({
      id: item.id,
      type: item.type,
      starts_at: item.starts_at || `${dateToYMD(item.date)}${item.time ? 'T' + item.time : ''}`,
      ends_at: item.ends_at || null,
      tz: item.tz || null,
      title: item.title,
      location: item.location || null,
    }));

    const userPrompt = `
TRIP DATE RANGE: Start: ${startDateStr || 'TBD'}, End: ${endDateStr || 'TBD'}
ITINERARY ITEMS:
${JSON.stringify(serializedItems, null, 2)}
WEATHER FORECAST:
${weatherForecast || 'Not available'}
TRAVEL ADVISORIES:
${advisories || 'None'}
`;

    const systemPrompt = `You are auditing a group trip itinerary for ways it could fail. Inputs: ordered items (id, type, starts_at, ends_at, tz, location), trip date range, and if available the weather forecast and any travel advisories.

Flag the failure modes:
- An item scheduled before arrival or after the return flight, or outside the trip date range
- A blank day within the trip (no plan)
- Overlapping activities (starts_at of one item falls before ends_at of the previous)
- Tight connecting-flight layovers below safe minimums (< 90 min domestic, < 2h international)
- Insufficient transfer time between airport ↔ hotel ↔ activity
- A night with no accommodation, or checkout before the departure flight
- Venue likely closed (day-of-week / public holiday)
- Geographically impossible transitions in the time available
- Outdoor activity on a severe-weather day
- No rest buffer after a red-eye / long-haul
- Over-stuffed day (too many items to be feasible)

Be specific and conservative — only real risks, not comfortable gaps. Give a helpful one-line fix for each.
Return JSON matching schema.`;

    const jsonSchema = {
      type: 'OBJECT',
      properties: {
        flags: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              itemId: { type: 'STRING', nullable: true },
              severity: { type: 'STRING', enum: ['info', 'warn', 'risk'] },
              issue: { type: 'STRING' },
              suggestion: { type: 'STRING' }
            },
            required: ['itemId', 'severity', 'issue', 'suggestion']
          }
        }
      },
      required: ['flags']
    };

    const rawResult = await complete(userPrompt, systemPrompt, jsonSchema);
    const result = JSON.parse(rawResult);
    return result.flags || [];
  } catch (err) {
    console.error('LLM Itinerary audit failed, falling back to empty list:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Coerce an itinerary item's `date` to a 'YYYY-MM-DD' string.
 * The pg driver returns a DATE column as a JS Date (local midnight), not a string,
 * so every consumer must normalise before doing string date math.
 */
function dateToYMD(date: string | Date | null | undefined): string {
  if (!date) return '';
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).split('T')[0];
}

/**
 * Parse YYYY-MM-DD safely without timezone offset shifting.
 * Rule §3.1: never use new Date(isoString) in time-sensitive date math.
 */
function parseDateComponents(s: string | Date): Date {
  const clean = dateToYMD(s);
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Get the absolute start instant for an item.
 * Prefers starts_at (TIMESTAMPTZ). Falls back to date + time, then date-only.
 */
function itemStart(item: ItineraryItem): Date | null {
  if (item.starts_at) return new Date(item.starts_at);
  if (item.time) {
    const [y, mo, d] = dateToYMD(item.date).split('-').map(Number);
    const [h, min] = item.time.split(':').map(Number);
    return new Date(y, mo - 1, d, h, min);
  }
  if (item.date) return parseDateComponents(item.date);
  return null;
}

/**
 * Get the absolute end instant for an item.
 * Prefers ends_at. Falls back to starts_at (point event).
 */
function itemEnd(item: ItineraryItem): Date | null {
  if (item.ends_at) return new Date(item.ends_at);
  return itemStart(item); // treat as instantaneous when no ends_at
}

/** Gap in minutes between end of a and start of b. Negative = overlap. */
function gapMinutes(a: ItineraryItem, b: ItineraryItem): number | null {
  const endA = itemEnd(a);
  const startB = itemStart(b);
  if (!endA || !startB) return null;
  return (startB.getTime() - endA.getTime()) / 60_000;
}

/** True interval overlap: a ends after b starts AND b ends after a starts. */
function intervalsOverlap(a: ItineraryItem, b: ItineraryItem): boolean {
  const startA = itemStart(a);
  const endA = itemEnd(a);
  const startB = itemStart(b);
  const endB = itemEnd(b);
  if (!startA || !endA || !startB || !endB) return false;
  // Intervals touch at a single point (endA === startB) → not an overlap
  return startA < endB && startB < endA;
}

/**
 * Get the local calendar date string (YYYY-MM-DD) for an item, respecting tz.
 * Falls back to the item's legacy `date` field when tz is absent.
 */
function localDateString(item: ItineraryItem): string {
  if (item.starts_at && item.tz) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: item.tz, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(item.starts_at));
    } catch {
      // Unknown tz — fall through
    }
  }
  return dateToYMD(item.date);
}

// ---------------------------------------------------------------------------
// Deterministic checker
// ---------------------------------------------------------------------------

export interface ItineraryIssue {
  type: 'blank_day' | 'overlap' | 'tight_connection' | 'post_return_activity' | 'flight_overlap';
  severity: 'warning' | 'error';
  message: string;
}

export function checkAllItineraryIssues(
  items: ItineraryItem[],
  startDateStr?: string,
  endDateStr?: string
): ItineraryIssue[] {
  const issues: ItineraryIssue[] = [];

  if (items.length === 0) return issues;

  // Deduplicate: keep only the first occurrence of each (type, date, title) triple.
  // DB duplicates can exist when the same flight appears in both a single voucher and
  // a full itinerary import — comparing them against each other produces false overlaps.
  const seen = new Set<string>();
  const deduped = items.filter(item => {
    // Use localDateString which resolves starts_at+tz first, then falls back to
    // item.date — so items created with the new tz-aware path (no date field) and
    // older rows (date field, no starts_at) for the same flight hash to the same key.
    const key = `${item.type}|${localDateString(item)}|${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort all items by start time ascending
  const sorted = [...deduped].sort((a, b) => {
    const sa = itemStart(a);
    const sb = itemStart(b);
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    return sa.getTime() - sb.getTime();
  });

  // Group by local calendar date (tz-aware when possible)
  const byDate: Record<string, ItineraryItem[]> = {};
  sorted.forEach(item => {
    const d = localDateString(item);
    (byDate[d] = byDate[d] || []).push(item);
  });

  // ------------------------------------------------------------------
  // 1. Blank days (within the declared trip date range)
  // ------------------------------------------------------------------
  if (startDateStr && endDateStr) {
    const rangeStart = parseDateComponents(startDateStr);
    const rangeEnd = parseDateComponents(endDateStr);
    const cur = new Date(rangeStart);
    let dayIndex = 1;
    while (cur <= rangeEnd) {
      const [y, m, d] = [cur.getFullYear(), cur.getMonth() + 1, cur.getDate()];
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!byDate[dateStr] || byDate[dateStr].length === 0) {
        issues.push({
          type: 'blank_day',
          severity: 'warning',
          message: `Day ${dayIndex} (${dateStr}) has nothing scheduled.`,
        });
      }
      cur.setDate(cur.getDate() + 1);
      dayIndex++;
    }
  }

  // ------------------------------------------------------------------
  // 2. Identify the last flight as the presumed return flight
  // ------------------------------------------------------------------
  const flights = sorted.filter(i => i.type === 'flight');
  const returnFlight = flights.length > 0 ? flights[flights.length - 1] : null;

  // ------------------------------------------------------------------
  // 3. Activities after the return flight departs
  // ------------------------------------------------------------------
  if (returnFlight) {
    const returnStart = itemStart(returnFlight);
    sorted.forEach(item => {
      if (item.id === returnFlight.id) return;
      const s = itemStart(item);
      if (returnStart && s && s > returnStart) {
        issues.push({
          type: 'post_return_activity',
          severity: 'error',
          message: `"${item.title}" is planned after your return flight ("${returnFlight.title}") departs.`,
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // 4. Per-day checks: overlaps, tight connections, flight overlaps
  // ------------------------------------------------------------------
  Object.entries(byDate).forEach(([dateStr, dayItems]) => {
    // Sort day's items by start time
    const day = [...dayItems].sort((a, b) => {
      const sa = itemStart(a);
      const sb = itemStart(b);
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sa.getTime() - sb.getTime();
    });

    for (let i = 0; i < day.length; i++) {
      for (let j = i + 1; j < day.length; j++) {
        const a = day[i];
        const b = day[j];

        // -- True interval overlap. Only meaningful when BOTH items have real
        // durations (ends_at); nominal hotel/activity times would create false
        // overlaps otherwise. --
        if (a.ends_at && b.ends_at) {
          if (intervalsOverlap(a, b)) {
            issues.push({
              type: a.type === 'flight' && b.type === 'flight' ? 'flight_overlap' : 'overlap',
              severity: 'error',
              message: `Overlap: "${a.title}" and "${b.title}" have conflicting time slots on ${dateStr}.`,
            });
            continue; // gap check not meaningful when overlapping
          }
        }

        // -- Tight connection: only flight→flight, where times are precise and
        // a "connection" is meaningful (connecting flights need ≥ 90 min). --
        if (a.type === 'flight' && b.type === 'flight') {
          const gap = gapMinutes(a, b);
          if (gap !== null && gap >= 0 && gap < 90) {
            issues.push({
              type: 'tight_connection',
              severity: 'error',
              message: `Tight connection: only ${Math.round(gap)} min between "${a.title}" and "${b.title}" (minimum recommended: 90 min).`,
            });
          }
        }
      }
    }
  });

  return issues;
}

// Keep the old conflict helper for backward compatibility (used by older callers)
export interface ItineraryConflict {
  item1: ItineraryItem;
  item2: ItineraryItem;
  type: 'tight_connection' | 'overlap';
  gapMinutes: number;
}

export function checkItineraryConflicts(items: ItineraryItem[]): ItineraryConflict[] {
  const conflicts: ItineraryConflict[] = [];

  // Group by local calendar date (tz-aware), then compare items within each day.
  const byDate: Record<string, ItineraryItem[]> = {};
  for (const it of items) {
    const d = localDateString(it);
    (byDate[d] ||= []).push(it);
  }

  for (const dayItems of Object.values(byDate)) {
    const day = [...dayItems].sort((a, b) => {
      const sa = itemStart(a);
      const sb = itemStart(b);
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sa.getTime() - sb.getTime();
    });

    for (let i = 0; i < day.length; i++) {
      for (let j = i + 1; j < day.length; j++) {
        const a = day[i];
        const b = day[j];

        // -- Overlap: only meaningful when BOTH items have real durations
        // (ends_at). Hotel check-in/out and activities use nominal placeholder
        // times, so comparing them would create false overlaps. --
        if (a.ends_at && b.ends_at) {
          if (intervalsOverlap(a, b)) {
            conflicts.push({ item1: a, item2: b, type: 'overlap', gapMinutes: 0 });
            continue;
          }
        }

        // -- Tight connection: only flight→flight. Other item types carry
        // nominal times (15:00 check-in, etc.) and mixing them with a flight's
        // true tz-aware instant produces meaningless gaps. --
        if (a.type === 'flight' && b.type === 'flight') {
          const gap = gapMinutes(a, b);
          if (gap !== null && gap >= 0 && gap < 90) {
            conflicts.push({ item1: a, item2: b, type: 'tight_connection', gapMinutes: Math.round(gap) });
          }
        }
      }
    }
  }

  return conflicts;
}
