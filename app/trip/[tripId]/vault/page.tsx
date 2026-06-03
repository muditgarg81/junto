'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import VaultClient from './VaultClient';
import { Trip, Member, VaultItem } from '@/lib/types';
import { authorizeTripAccess } from '@/lib/authz';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function VaultPage({ params }: PageProps) {
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

  // 3. Fetch Vault Items
  const vaultItemsRes = await query(
    'SELECT * FROM vault_items WHERE trip_id = $1 ORDER BY created_at DESC',
    [tripId]
  );
  const vaultItems: VaultItem[] = vaultItemsRes.rows;

  // 4. Resolve current member session details from authorized DB record
  const currentMember = {
    memberId: authMember.id,
    memberName: authMember.name || authUser.name,
    role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
    photoUrl: authUser.photo_url || null,
  };

  return (
    <VaultClient
      trip={trip}
      members={members}
      initialVaultItems={vaultItems}
      currentMember={currentMember}
    />
  );
}
