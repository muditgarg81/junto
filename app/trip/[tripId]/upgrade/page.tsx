'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { Trip, Member } from '@/lib/types';
import UpgradeClient from './UpgradeClient';
import { authorizeTripAccess } from '@/lib/authz';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function UpgradePage({ params }: PageProps) {
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

  // 1. Fetch Trip
  const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (tripRes.rows.length === 0) {
    notFound();
  }
  const trip: Trip = tripRes.rows[0];

  // 2. Fetch Members
  const membersRes = await query(
    'SELECT * FROM members WHERE trip_id = $1 ORDER BY created_at ASC',
    [tripId]
  );
  const members: Member[] = membersRes.rows;

  // 3. Resolve current member session details from authorized DB record
  const currentMember = {
    memberId: authMember.id,
    memberName: authMember.name || authUser.name,
    role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
  };

  return (
    <UpgradeClient
      trip={trip}
      members={members}
      currentMember={currentMember}
    />
  );
}
