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
