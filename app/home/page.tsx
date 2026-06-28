import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import YourTripsClient from '@/app/(marketing)/YourTripsClient';

export default async function HomePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/signin?redirect=/home');
  }

  if (!user) {
    redirect('/signin?redirect=/home');
  }

  let dbTrips: any[] = [];
  let unpackedItems: any[] = [];
  try {
    const tripsRes = await query(`
      SELECT t.*,
        ('organizer' = ANY(m_user.roles)) AS is_creator,
        (
          SELECT o.payload
          FROM decisions d
          JOIN options o ON d.resolved_option_id = o.id
          WHERE d.trip_id = t.id AND d.type = 'dates' AND d.status = 'locked'
          ORDER BY d.created_at DESC
          LIMIT 1
        ) AS dates_payload,
        (
          SELECT json_agg(json_build_object('name', COALESCE(u_m.name, m.name), 'photo_url', u_m.photo_url))
          FROM members m
          LEFT JOIN users u_m ON m.user_id = u_m.id OR m.auth_id = u_m.auth_id
          WHERE m.trip_id = t.id AND m.status = 'confirmed'
        ) AS members
      FROM trips t
      JOIN members m_user ON t.id = m_user.trip_id
      WHERE m_user.user_id = $1 OR m_user.auth_id = $2
      ORDER BY t.created_at DESC
    `, [user.id, user.auth_id]);
    dbTrips = tripsRes.rows;

    // Auto-complete trips whose end date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiredIds: string[] = [];
    for (const trip of dbTrips) {
      if (trip.status === 'done') continue;
      const payload = trip.dates_payload
        ? (typeof trip.dates_payload === 'string' ? JSON.parse(trip.dates_payload) : trip.dates_payload)
        : null;
      if (payload?.endDate) {
        const [y, m, d] = payload.endDate.split('T')[0].split('-').map(Number);
        const end = new Date(y, m - 1, d);
        if (end < today) expiredIds.push(trip.id);
      }
    }
    if (expiredIds.length > 0) {
      await query(
        `UPDATE trips SET status = 'done' WHERE id = ANY($1::uuid[])`,
        [expiredIds]
      );
      dbTrips = dbTrips.map((t) =>
        expiredIds.includes(t.id) ? { ...t, status: 'done' } : t
      );
    }

    const unpackedItemsRes = await query(`
      SELECT ci.id, ci.label, ci.category, t.id as trip_id, t.name as trip_name
      FROM checklist_items ci
      JOIN trips t ON ci.trip_id = t.id
      WHERE ci.done = false
        AND t.status IN ('planning', 'active')
        AND ci.assigned_to IN (
          SELECT id FROM members
          WHERE user_id = $1 OR auth_id = $2
        )
      ORDER BY ci.created_at ASC
    `, [user.id, user.auth_id]);
    unpackedItems = unpackedItemsRes.rows;
  } catch {
    // degrade gracefully
  }

  return (
    <YourTripsClient
      user={user}
      dbTrips={dbTrips}
      unpackedItems={unpackedItems}
    />
  );
}
