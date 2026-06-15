'use server';

import { query } from '@/lib/db';
import { authorizeTripAccess } from '@/lib/authz';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

interface ItineraryInput {
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  type: 'flight' | 'stay' | 'activity' | 'other';
  title: string;
  location: string | null;
}

/**
 * Creates a manually defined itinerary item.
 */
export async function addItineraryItemAction(tripId: string, data: ItineraryInput) {
  try {
    // 1. Verify membership access
    await authorizeTripAccess(tripId);

    const { date, time, type, title, location } = data;
    if (!date || !type || !title) {
      return { error: 'Date, type, and title are required.' };
    }

    const id = crypto.randomUUID();
    const formattedTime = time && time.trim() !== '' ? time.trim() : null;

    await query(
      `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
      [
        id,
        tripId,
        date,
        formattedTime,
        type,
        title.trim(),
        location && location.trim() !== '' ? location.trim() : null
      ]
    );

    revalidatePath(`/trip/${tripId}/itinerary`);
    return { success: true };
  } catch (err: any) {
    console.error('addItineraryItemAction failed:', err);
    return { error: err.message || 'Server error adding itinerary item.' };
  }
}

/**
 * Clears the entire itinerary for a trip (all items). Consequential — the
 * caller must confirm with the user first. Vault vouchers are left intact;
 * only the timeline items are removed.
 */
export async function clearItineraryAction(tripId: string) {
  try {
    await authorizeTripAccess(tripId);

    const result = await query(
      'DELETE FROM itinerary_items WHERE trip_id = $1 RETURNING id',
      [tripId]
    );

    revalidatePath(`/trip/${tripId}/itinerary`);
    return { success: true, deleted: result.rowCount ?? 0 };
  } catch (err: any) {
    console.error('clearItineraryAction failed:', err);
    return { error: err.message || 'Server error clearing itinerary.' };
  }
}

/**
 * Updates an itinerary item's editable fields.
 */
export async function updateItineraryItemAction(
  tripId: string,
  itemId: string,
  data: ItineraryInput
) {
  try {
    await authorizeTripAccess(tripId);
    const { date, time, type, title, location } = data;
    if (!date || !type || !title) {
      return { error: 'Date, type, and title are required.' };
    }
    const formattedTime = time && time.trim() !== '' ? time.trim() : null;
    const result = await query(
      `UPDATE itinerary_items
         SET date = $1, time = $2, type = $3, title = $4, location = $5
       WHERE id = $6 AND trip_id = $7
       RETURNING id`,
      [
        date,
        formattedTime,
        type,
        title.trim(),
        location && location.trim() !== '' ? location.trim() : null,
        itemId,
        tripId,
      ]
    );
    if (result.rowCount === 0) {
      return { error: 'Itinerary item not found.' };
    }
    revalidatePath(`/trip/${tripId}/itinerary`);
    return { success: true };
  } catch (err: any) {
    console.error('updateItineraryItemAction failed:', err);
    return { error: err.message || 'Server error updating itinerary item.' };
  }
}

/**
 * Deletes an itinerary item.
 */
export async function deleteItineraryItemAction(tripId: string, itemId: string) {
  try {
    // 1. Verify membership access
    await authorizeTripAccess(tripId);

    const result = await query(
      'DELETE FROM itinerary_items WHERE id = $1 AND trip_id = $2 RETURNING id',
      [itemId, tripId]
    );

    if (result.rowCount === 0) {
      return { error: 'Itinerary item not found.' };
    }

    revalidatePath(`/trip/${tripId}/itinerary`);
    return { success: true };
  } catch (err: any) {
    console.error('deleteItineraryItemAction failed:', err);
    return { error: err.message || 'Server error deleting itinerary item.' };
  }
}
