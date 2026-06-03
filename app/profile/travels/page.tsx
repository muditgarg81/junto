'use strict';

import React from 'react';
import { query } from '@/lib/db';
import { Trip } from '@/lib/types';
import TravelsClient from './TravelsClient';

export default async function TravelsPage() {
  // Fetch real trips from database
  const tripsRes = await query(`
    SELECT t.*, COUNT(m.id) as member_count
    FROM trips t
    LEFT JOIN members m ON t.id = m.trip_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  const dbTrips = tripsRes.rows;

  return (
    <TravelsClient
      dbTrips={dbTrips}
    />
  );
}
