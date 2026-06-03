'use strict';

import { ItineraryItem } from './types';

export interface ItineraryConflict {
  item1: ItineraryItem;
  item2: ItineraryItem;
  type: 'tight_connection' | 'overlap';
  gapMinutes: number;
}

/**
 * Checks for itinerary conflicts:
 * - Event pairs on the same date scheduled within 90 minutes of each other.
 */
export function checkItineraryConflicts(items: ItineraryItem[]): ItineraryConflict[] {
  const conflicts: ItineraryConflict[] = [];

  // Group items by date
  const byDate: Record<string, ItineraryItem[]> = {};
  items.forEach((item) => {
    // Normalise date string (e.g. format date to YYYY-MM-DD string)
    const dateStr = typeof item.date === 'string' 
      ? item.date.split('T')[0] 
      : new Date(item.date).toISOString().split('T')[0];
    
    if (!byDate[dateStr]) {
      byDate[dateStr] = [];
    }
    byDate[dateStr].push(item);
  });

  // Check each day's items
  Object.keys(byDate).forEach((dateStr) => {
    const dayItems = byDate[dateStr].filter((item) => !!item.time);

    // Sort items chronologically by time
    dayItems.sort((a, b) => {
      return (a.time || '').localeCompare(b.time || '');
    });

    for (let i = 0; i < dayItems.length; i++) {
      for (let j = i + 1; j < dayItems.length; j++) {
        const item1 = dayItems[i];
        const item2 = dayItems[j];

        const t1 = parseTimeToMinutes(item1.time!);
        const t2 = parseTimeToMinutes(item2.time!);

        if (t1 !== null && t2 !== null) {
          const diff = Math.abs(t2 - t1);
          if (diff <= 90) {
            conflicts.push({
              item1,
              item2,
              type: diff === 0 ? 'overlap' : 'tight_connection',
              gapMinutes: diff
            });
          }
        }
      }
    }
  });

  return conflicts;
}

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}
