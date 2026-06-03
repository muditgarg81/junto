'use server';

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

export async function createTripAction(prevState: any, formData: FormData) {
  const tripName = formData.get('tripName') as string;
  const destination = formData.get('destination') as string;
  const baseCurrency = (formData.get('baseCurrency') as string) || 'INR';
  const addDatesLater = formData.get('addDatesLater') === 'true';
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;

  if (!tripName) {
    return { error: 'Trip name is required.' };
  }

  try {
    const user = await getCurrentUser(true);
    if (!user) {
      return { error: 'You must be onboarded to create a trip.' };
    }

    const tripId = crypto.randomUUID();
    const inviteToken = crypto.randomBytes(16).toString('hex');

    // 1. Insert Trip
    await query(
      `INSERT INTO trips (id, name, status, base_currency, invite_token)
       VALUES ($1, $2, 'planning', $3, $4)`,
      [tripId, tripName, baseCurrency, inviteToken]
    );

    // 2. Insert Creator as Confirmed Member with organizer role, linked to user_id
    const memberId = crypto.randomUUID();
    await query(
      `INSERT INTO members (id, trip_id, name, status, roles, auth_id, user_id, upi_id)
       VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7)`,
      [memberId, tripId, user.name, ['organizer'], user.auth_id, user.id, user.upi_id]
    );

    // 3. If dates are provided and not skipped, insert a decision for dates in 'locked' state
    if (!addDatesLater && startDate && endDate) {
      const decisionId = crypto.randomUUID();
      const optionId = crypto.randomUUID();

      // Insert decision with resolved_option_id as NULL first
      await query(
        `INSERT INTO decisions (id, trip_id, type, title, status, resolved_option_id)
         VALUES ($1, $2, 'dates', 'Trip Dates', 'locked', NULL)`,
        [decisionId, tripId]
      );

      // Insert option referencing the decision ID
      await query(
        `INSERT INTO options (id, decision_id, label, payload, proposed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [optionId, decisionId, `${startDate} to ${endDate}`, JSON.stringify({ startDate, endDate }), memberId]
      );

      // Update decision with the option ID
      await query(
        `UPDATE decisions SET resolved_option_id = $1 WHERE id = $2`,
        [optionId, decisionId]
      );
    }

    // 4. If destination is provided, insert a decision for destination in 'locked' state
    if (destination) {
      const decisionId = crypto.randomUUID();
      const optionId = crypto.randomUUID();

      // Insert decision with resolved_option_id as NULL first
      await query(
        `INSERT INTO decisions (id, trip_id, type, title, status, resolved_option_id)
         VALUES ($1, $2, 'destination', 'Destination', 'locked', NULL)`,
        [decisionId, tripId]
      );

      // Insert option referencing the decision ID
      await query(
        `INSERT INTO options (id, decision_id, label, payload, proposed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [optionId, decisionId, destination, JSON.stringify({ destination }), memberId]
      );

      // Update decision with the option ID
      await query(
        `UPDATE decisions SET resolved_option_id = $1 WHERE id = $2`,
        [optionId, decisionId]
      );
    }

    // 5. Store member session in cookies
    const cookieStore = await cookies();
    cookieStore.set(
      `junto_member_${tripId}`,
      JSON.stringify({
        memberId,
        memberName: user.name,
        role: 'organizer',
      }),
      {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        httpOnly: false,
        sameSite: 'lax',
      }
    );

    return { success: true, tripId };
  } catch (err: any) {
    console.error('Error creating trip:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Server Action to delete a trip. Only the trip organizer/creator can delete it.
 */
export async function deleteTripAction(tripId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'Unauthorized: You must be logged in.' };
    }

    // 1. Verify that the current user has the 'organizer' role for the trip
    const memberRes = await query(
      `SELECT id, roles FROM members WHERE trip_id = $1 AND (user_id = $2 OR auth_id = $3) LIMIT 1`,
      [tripId, user.id, user.auth_id]
    );

    if (memberRes.rows.length === 0) {
      return { error: 'Forbidden: You are not a member of this trip.' };
    }

    const roles = memberRes.rows[0].roles || [];
    if (!roles.includes('organizer')) {
      return { error: 'Forbidden: Only the person who created this trip can delete it.' };
    }

    // 2. Perform Cascade Deletion in DB
    await query('DELETE FROM trips WHERE id = $1', [tripId]);

    // 3. Clear the associated member session cookie if it exists in the operator's browser
    const cookieStore = await cookies();
    cookieStore.delete(`junto_member_${tripId}`);

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('deleteTripAction failed:', err);
    return { error: err.message || 'Server error during trip deletion.' };
  }
}
