import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import GuestJoinForm from './GuestJoinForm';
import { APP_NAME } from '@/lib/constants';

interface PageProps {
  params: Promise<{ inviteToken: string }>;
}

export default async function GuestJoinPage({ params }: PageProps) {
  const { inviteToken } = await params;

  // 0. Check if user is onboarded
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/onboarding?redirect=/join/${inviteToken}`);
  }

  // 1. Fetch trip details by invite token
  const tripRes = await query('SELECT * FROM trips WHERE invite_token = $1', [inviteToken]);
  if (tripRes.rows.length === 0) {
    notFound();
  }
  const trip = tripRes.rows[0];

  // 2. Fetch organizer's name for a personalized greeting
  const organizerRes = await query(
    `SELECT name FROM members WHERE trip_id = $1 AND 'organizer' = ANY(roles) LIMIT 1`,
    [trip.id]
  );
  const organizerName = organizerRes.rows[0]?.name || 'Your friend';

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between px-6 py-8 overflow-hidden max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      {/* Background Gradient Washes */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#ffdbcf] rounded-full blur-[100px] opacity-40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-ai-sage-tint rounded-full blur-[100px] opacity-50 pointer-events-none" />

      {/* Top logo alignment */}
      <div className="text-center font-display text-2xl text-ink-text pt-2 select-none opacity-40">
        {APP_NAME}
      </div>

      {/* Centered card content */}
      <div className="flex-grow flex flex-col justify-center z-10 py-6">
        <div className="text-center space-y-3 mb-8">
          <span className="font-label-caps text-[11px] text-secondary px-3 py-1 bg-[#a04018]/10 rounded-full inline-block">
            You are invited
          </span>
          <h1 className="font-headline-lg text-ink-text leading-tight">
            Join {trip.name}
          </h1>
          <p className="font-body-md text-muted-text max-w-xs mx-auto">
            {organizerName} invited you to join the trip planning group!
          </p>
        </div>

        {/* Dynamic Join Form */}
        <GuestJoinForm inviteToken={inviteToken} user={user} />
      </div>

      {/* Footer info */}
      <div className="text-center font-body-sm text-muted-text py-2 z-10">
        No app download or account creation needed.
      </div>
    </div>
  );
}
