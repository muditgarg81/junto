'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import LocalInfoClient from './LocalInfoClient';
import { authorizeTripAccess } from '@/lib/authz';
import { Trip } from '@/lib/types';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function LocalInfoPage({ params }: PageProps) {
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

  return (
    <LocalInfoClient
      trip={trip}
      currentMember={{
        memberId: authMember.id,
        memberName: authMember.name || authUser.name,
        role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
        photoUrl: authUser.photo_url || null,
      }}
    />
  );
}
