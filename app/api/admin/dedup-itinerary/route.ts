'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Simple admin key guard — set ADMIN_SECRET in .env.local
function isAuthorized(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // must explicitly set a secret
  return req.nextUrl.searchParams.get('secret') === secret;
}

/**
 * GET  /api/admin/dedup-itinerary?secret=<ADMIN_SECRET>
 *   → dry-run: shows what would be deleted
 *
 * GET  /api/admin/dedup-itinerary?secret=<ADMIN_SECRET>&confirm=1
 *   → actually deletes the duplicates
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const confirm = req.nextUrl.searchParams.get('confirm') === '1';

  // Find all rows that are duplicates: same trip_id + type + date + normalised title.
  // Keep the row with the earliest created_at; mark the rest for deletion.
  const dupsResult = await query(`
    SELECT id, trip_id, type, date, title, created_at, source_vault_item_id,
           ROW_NUMBER() OVER (
             PARTITION BY trip_id, type, date,
                          LOWER(REGEXP_REPLACE(title, '\\s+', '', 'g'))
             ORDER BY created_at ASC
           ) AS rn
    FROM itinerary_items
    ORDER BY trip_id, type, date, title, created_at
  `);

  const toDelete = dupsResult.rows.filter((r: any) => r.rn > 1);
  const toKeep   = dupsResult.rows.filter((r: any) => r.rn === 1);

  const byType: Record<string, number> = {};
  for (const r of dupsResult.rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ message: 'No duplicates found.', total: dupsResult.rows.length, byType });
  }

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      message: `Found ${toDelete.length} duplicate row(s). Add &confirm=1 to delete them.`,
      wouldDelete: toDelete.map((r: any) => ({
        id: r.id,
        type: r.type,
        date: r.date,
        title: r.title,
        source_vault_item_id: r.source_vault_item_id,
        created_at: r.created_at,
      })),
      wouldKeep: toKeep.map((r: any) => ({
        id: r.id,
        type: r.type,
        date: r.date,
        title: r.title,
        created_at: r.created_at,
      })),
    });
  }

  // Delete the duplicates
  const idsToDelete = toDelete.map((r: any) => r.id);
  await query(
    `DELETE FROM itinerary_items WHERE id = ANY($1::uuid[])`,
    [idsToDelete]
  );

  return NextResponse.json({
    deleted: idsToDelete.length,
    deletedIds: idsToDelete,
  });
}
