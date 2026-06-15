import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import WelcomeClient from './WelcomeClient';
import YourTripsClient from './YourTripsClient';

export default async function HomePage() {
  // Always show landing page first; authenticated users redirected client-side
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    return <WelcomeClient user={null} />;
  }

  if (!user) {
    return <WelcomeClient user={null} />;
  }

  // Fetch user's trips from database
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
    // DB query failed — show trips client with empty data
  }

  return (
    <YourTripsClient
      user={user}
      dbTrips={dbTrips}
      unpackedItems={unpackedItems}
    />
  );
}
