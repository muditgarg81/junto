'use server';

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function joinTripAction(inviteToken: string, status: 'confirmed' | 'maybe', formData: FormData) {
  try {
    const user = await getCurrentUser(true);
    if (!user) {
      return { error: 'You must be onboarded to join a trip.' };
    }

    // 1. Fetch trip by invite token
    const tripRes = await query('SELECT * FROM trips WHERE invite_token = $1', [inviteToken]);
    if (tripRes.rows.length === 0) {
      return { error: 'Invalid invite link or token.' };
    }
    const trip = tripRes.rows[0];

    // Reject expired invite tokens (legacy rows with NULL expiry are allowed through)
    if (trip.invite_token_expires_at && new Date(trip.invite_token_expires_at) < new Date()) {
      return { error: 'This invite link has expired. Ask the trip organiser for a new one.' };
    }
    const tripId = trip.id;

    // 2. Check if this user is already a member of the trip
    const existingRes = await query(
      'SELECT * FROM members WHERE trip_id = $1 AND (user_id = $2 OR auth_id = $3)', 
      [tripId, user.id, user.auth_id]
    );
    let memberId;

    if (existingRes.rows.length > 0) {
      memberId = existingRes.rows[0].id;
      await query('UPDATE members SET status = $1 WHERE id = $2', [status, memberId]);
    } else {
      memberId = crypto.randomUUID();
      await query(
        `INSERT INTO members (id, trip_id, name, status, roles, auth_id, user_id, upi_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [memberId, tripId, user.name, status, [], user.auth_id, user.id, user.upi_id]
      );
    }

    // 3. Store member session in cookies
    const cookieStore = await cookies();
    cookieStore.set(
      `junto_member_${tripId}`,
      JSON.stringify({
        memberId,
        memberName: user.name,
        role: 'guest',
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
    console.error('Error joining trip:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
