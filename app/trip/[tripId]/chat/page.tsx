'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import ChatClient from './ChatClient';
import { authorizeTripAccess } from '@/lib/authz';
import { Trip, Member, Message } from '@/lib/types';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
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

  // 3. Fetch Recent Messages
  const messagesRes = await query(
    `SELECT m.*, memb.name as author_name 
     FROM messages m 
     LEFT JOIN members memb ON m.author_id = memb.id 
     WHERE m.trip_id = $1 
     ORDER BY m.created_at DESC LIMIT 50`,
    [tripId]
  );
  // Reverse to make it chronological
  const messages = messagesRes.rows.reverse();

  // 4. Resolve current member context from authorized DB session
  const currentMember = {
    memberId: authMember.id,
    memberName: authMember.name || authUser.name,
    role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
    photoUrl: authUser.photo_url || null,
  };

  return (
    <ChatClient
      trip={trip}
      members={members}
      initialMessages={messages}
      currentMember={currentMember}
    />
  );
}
