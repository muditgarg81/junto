'use server';

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

/**
 * Fetches other trips that the current user is a member of which contain checklist items.
 */
export async function getImportableTripsAction(currentTripId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const res = await query(
      `SELECT DISTINCT t.id, t.name, t.created_at
       FROM trips t
       JOIN members m ON t.id = m.trip_id
       WHERE (m.user_id = $1 OR m.auth_id = $2)
         AND t.id != $3
         AND EXISTS (SELECT 1 FROM checklist_items WHERE trip_id = t.id)
       ORDER BY t.created_at DESC`,
      [user.id, user.auth_id, currentTripId]
    );

    return { trips: res.rows };
  } catch (err: any) {
    console.error('getImportableTripsAction failed:', err);
    return { error: err.message || 'Server error fetching past trips.' };
  }
}

/**
 * Imports checklist items from a source trip into the target trip.
 * Resetting 'done' status, clearing 'assigned_to', and de-duplicating.
 */
export async function importChecklistAction(targetTripId: string, sourceTripId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Verify user is member of both trips
    const memberTarget = await query(
      'SELECT id FROM members WHERE trip_id = $1 AND (user_id = $2 OR auth_id = $3) LIMIT 1',
      [targetTripId, user.id, user.auth_id]
    );
    if (memberTarget.rows.length === 0) throw new Error('Forbidden: Not a member of target trip');

    const memberSource = await query(
      'SELECT id FROM members WHERE trip_id = $1 AND (user_id = $2 OR auth_id = $3) LIMIT 1',
      [sourceTripId, user.id, user.auth_id]
    );
    if (memberSource.rows.length === 0) throw new Error('Forbidden: Not a member of source trip');

    // 2. Fetch checklist items from source trip
    const sourceItemsRes = await query(
      'SELECT label, category FROM checklist_items WHERE trip_id = $1',
      [sourceTripId]
    );
    const sourceItems = sourceItemsRes.rows;

    // 3. Fetch existing checklist items in target trip to de-dupe
    const existingItemsRes = await query(
      'SELECT label, category FROM checklist_items WHERE trip_id = $1',
      [targetTripId]
    );
    const existingSet = new Set(
      existingItemsRes.rows.map(item => `${item.label.toLowerCase()}:${item.category}`)
    );

    // 4. Copy items
    let importedCount = 0;
    for (const item of sourceItems) {
      const key = `${item.label.toLowerCase()}:${item.category}`;
      if (existingSet.has(key)) {
        continue; // skip duplicate
      }

      await query(
        `INSERT INTO checklist_items (id, trip_id, label, category, assigned_to, per_person, done, source, imported_from_trip_id)
         VALUES ($1, $2, $3, $4, NULL, false, false, 'imported', $5)`,
        [crypto.randomUUID(), targetTripId, item.label, item.category, sourceTripId]
      );
      importedCount++;
    }

    revalidatePath(`/trip/${targetTripId}/checklist`);
    return { success: true, importedCount };
  } catch (err: any) {
    console.error('importChecklistAction failed:', err);
    return { error: err.message || 'Server error importing checklist.' };
  }
}

/**
 * Assigns a checklist item to a specific member.
 */
export async function assignChecklistItemAction(tripId: string, itemId: string, assigneeMemberId: string | null) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    // Verify user is member of the trip
    const memberCheck = await query(
      'SELECT id FROM members WHERE trip_id = $1 AND (user_id = $2 OR auth_id = $3) LIMIT 1',
      [tripId, user.id, user.auth_id]
    );
    if (memberCheck.rows.length === 0) throw new Error('Forbidden');

    // If assigneeMemberId is provided, verify they are also a member of the trip
    if (assigneeMemberId) {
      const assigneeCheck = await query(
        'SELECT id FROM members WHERE id = $1 AND trip_id = $2 LIMIT 1',
        [assigneeMemberId, tripId]
      );
      if (assigneeCheck.rows.length === 0) throw new Error('Invalid assignee');
    }

    // Update assignment
    await query(
      'UPDATE checklist_items SET assigned_to = $1 WHERE id = $2 AND trip_id = $3',
      [assigneeMemberId, itemId, tripId]
    );

    revalidatePath(`/trip/${tripId}/checklist`);
    return { success: true };
  } catch (err: any) {
    console.error('assignChecklistItemAction failed:', err);
    return { error: err.message || 'Server error assigning checklist item.' };
  }
}
