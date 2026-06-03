'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import ChecklistClient from './ChecklistClient';
import { authorizeTripAccess } from '@/lib/authz';
import { Trip, Member, ChecklistItem } from '@/lib/types';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function ChecklistPage({ params }: PageProps) {
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

  // 2. Fetch Members of the trip with photo_url
  const membersRes = await query(
    `SELECT m.*, u.photo_url 
     FROM members m
     LEFT JOIN users u ON m.user_id = u.id OR m.auth_id = u.auth_id
     WHERE m.trip_id = $1 
     ORDER BY m.created_at ASC`,
    [tripId]
  );
  const members: Member[] = membersRes.rows;

  // 3. Fetch Checklist Items
  const checklistItemsRes = await query(
    'SELECT * FROM checklist_items WHERE trip_id = $1 ORDER BY created_at ASC',
    [tripId]
  );
  const checklistItems: ChecklistItem[] = checklistItemsRes.rows;

  // 4. Resolve current member session details from authorized DB record
  const currentMember = {
    memberId: authMember.id,
    memberName: authMember.name || authUser.name,
    role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
    photoUrl: authUser.photo_url || null,
  };

  return (
    <ChecklistClient
      trip={trip}
      members={members}
      initialChecklistItems={checklistItems}
      currentMember={currentMember}
    />
  );
}
