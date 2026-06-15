'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function isAuthorized(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.nextUrl.searchParams.get('secret') === secret;
}

/**
 * GET /api/admin/resync-itinerary?secret=<>&tripId=<>
 *   Reads the itinerary vault_item stored for the trip, and re-inserts all activities
 *   into itinerary_items. Dry-run by default; add &confirm=1 to write.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tripId = req.nextUrl.searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  const confirm = req.nextUrl.searchParams.get('confirm') === '1';

  // Find the itinerary vault item for this trip
  const vaultRes = await query(
    `SELECT id, fields FROM vault_items WHERE trip_id = $1 AND kind = 'itinerary' ORDER BY created_at DESC LIMIT 1`,
    [tripId]
  );

  if (vaultRes.rows.length === 0) {
    return NextResponse.json({ error: 'No itinerary vault item found for this trip' });
  }

  const vaultItem = vaultRes.rows[0];
  const rawFields = vaultItem.fields;
  const fields = typeof rawFields === 'string' ? JSON.parse(rawFields) : rawFields;

  const activities = Array.isArray(fields.activities) ? fields.activities : [];
  const stays = Array.isArray(fields.stays) ? fields.stays : [];
  const flights = Array.isArray(fields.flights) ? fields.flights : [];

  // Show what's stored
  const preview = {
    vaultItemId: vaultItem.id,
    totalActivities: activities.length,
    totalStays: stays.length,
    totalFlights: flights.length,
    firstFewActivities: activities.slice(0, 3).map((a: any) => ({
      activityName: a.activityName,
      date: a.date,
      time: a.time,
    })),
  };

  if (!confirm) {
    return NextResponse.json({ dryRun: true, preview });
  }

  // Actually re-insert activities
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const a of activities) {
    const { activityName, date, time, location } = a || {};
    if (!date) { skipped++; continue; }

    const formattedDate = String(date).split('T')[0];
    const title = activityName || 'Activity';

    try {
      const existing = await query(
        'SELECT id FROM itinerary_items WHERE trip_id = $1 AND type = $2 AND date = $3 AND title = $4 LIMIT 1',
        [tripId, 'activity', formattedDate, title]
      );
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      await query(
        `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(), tripId, formattedDate,
          time ? String(time).trim() : null,
          'activity', title,
          location || null,
          vaultItem.id,
        ]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`${title} (${date}): ${err.message}`);
    }
  }

  return NextResponse.json({ inserted, skipped, errors, preview });
}
