'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { Trip, Member, ItineraryItem } from '@/lib/types';
import { authorizeTripAccess } from '@/lib/authz';
import ItineraryClient from './ItineraryClient';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function ItineraryPage({ params }: PageProps) {
  const { tripId } = await params;

  let authUser;
  let authMember;
  try {
    const auth = await authorizeTripAccess(tripId);
    authUser = auth.user;
    authMember = auth.member;
  } catch (err) {
    notFound();
  }

  // 1. Fetch Trip details
  const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (tripRes.rows.length === 0) {
    notFound();
  }
  const trip: Trip = tripRes.rows[0];

  // 2. Fetch Members of the trip
  const membersRes = await query(
    'SELECT * FROM members WHERE trip_id = $1 ORDER BY created_at ASC',
    [tripId]
  );
  const members: Member[] = membersRes.rows;

  // 3. Fetch Itinerary Items
  const itineraryItemsRes = await query(
    'SELECT * FROM itinerary_items WHERE trip_id = $1 ORDER BY date ASC, time ASC',
    [tripId]
  );
  const itineraryItems: ItineraryItem[] = itineraryItemsRes.rows;

  // 4. Fetch resolved Dates decision to constrain the calendar/date inputs
  const datesRes = await query(
    `SELECT o.payload
     FROM decisions d
     JOIN options o ON d.resolved_option_id = o.id
     WHERE d.trip_id = $1 AND d.type = 'dates' AND d.status = 'locked'
     LIMIT 1`,
    [tripId]
  );
  const datesPayload = datesRes.rows[0]?.payload || null;

  // 5. Fetch activity offers for P0 inline placement (one per activity category, shown, not dismissed)
  let activityOffers: any[] = [];
  try {
    const offersRes = await query(
      `SELECT * FROM offers
       WHERE trip_id = $1 AND category = 'activity' AND status = 'shown'
       ORDER BY created_at ASC`,
      [tripId]
    );
    activityOffers = offersRes.rows;
  } catch {
    // offers table may not exist yet — degrade gracefully
  }

  return (
    <ItineraryClient
      trip={trip}
      members={members}
      initialItineraryItems={itineraryItems}
      datesPayload={datesPayload}
      activityOffers={activityOffers}
      currentMember={{
        memberId: authMember.id,
        memberName: authMember.name || authUser.name,
        role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
        photoUrl: authUser.photo_url || null,
      }}
    />
  );
}
