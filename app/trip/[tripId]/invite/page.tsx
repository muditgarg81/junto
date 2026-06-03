'use strict';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { headers } from 'next/headers';
import InviteCopyPill from '@/components/InviteCopyPill';
import BottomNav from '@/components/BottomNav';
import { ArrowLeft, Users, ArrowRight } from 'lucide-react';
import { Member, Trip } from '@/lib/types';
import { authorizeTripAccess } from '@/lib/authz';

// Simple hash helper for color selection
function getAvatarBgColor(name: string) {
  const colors = [
    'bg-[#1f4d3f]/10 text-[#1f4d3f]', // Pine Green tint
    'bg-[#a04018]/10 text-[#a04018]', // Terracotta tint
    'bg-[#B98A3C]/10 text-[#B98A3C]', // Gold tint
    'bg-[#422b00]/10 text-[#422b00]', // Brown tint
    'bg-[#023629]/10 text-[#023629]', // Primary Green tint
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { tripId } = await params;

  try {
    await authorizeTripAccess(tripId);
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

  // 3. Resolve the full invite link dynamically
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const proto = headersList.get('x-forwarded-proto') || 'http';
  const inviteLink = `${proto}://${host}/join/${trip.invite_token}`;

  // 4. Group members by status
  const going = members.filter((m) => m.status === 'confirmed');
  const maybe = members.filter((m) => m.status === 'maybe');
  const invited = members.filter((m) => m.status === 'invited');

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm overflow-x-hidden">
      {/* Background wash */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffdbcf] rounded-full blur-[80px] opacity-30 pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-grow px-6 py-6 space-y-6 z-10">
        {/* App Bar */}
        <div className="flex items-center gap-4">
          <Link href={`/trip/${tripId}/chat`} className="text-ink-text hover:text-secondary transition p-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="font-headline-md text-ink-text leading-tight">Who&apos;s in</h1>
            <p className="font-body-sm text-muted-text">{trip.name}</p>
          </div>
        </div>

        {/* Copyable Invite Link Card */}
        <InviteCopyPill inviteLink={inviteLink} />

        {/* Member Roster list */}
        <div className="space-y-6">
          {/* Confirmed / Going section */}
          {going.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-label-caps text-xs text-muted-text flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1f4d3f]" />
                Going ({going.length})
              </h2>
              <div className="space-y-2">
                {going.map((member) => {
                  const mName = member.name || 'Guest';
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-card-cream border border-border-warm-grey px-4 py-3 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-headline-sm text-sm ${getAvatarBgColor(
                            mName
                          )}`}
                        >
                          {mName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-body-md font-medium text-ink-text">{mName}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {member.roles.map((role) => (
                          <span
                            key={role}
                            className="font-label-caps text-[9px] bg-ai-sage-tint text-[#1f4d3f] border border-[#1f4d3f]/20 px-2 py-0.5 rounded-full"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Maybe section */}
          {maybe.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-label-caps text-xs text-muted-text flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#B98A3C]" />
                Maybe ({maybe.length})
              </h2>
              <div className="space-y-2">
                {maybe.map((member) => {
                  const mName = member.name || 'Guest';
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-card-cream border border-border-warm-grey px-4 py-3 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-headline-sm text-sm ${getAvatarBgColor(
                            mName
                          )}`}
                        >
                          {mName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-body-md font-medium text-ink-text">{mName}</span>
                      </div>
                      <span className="font-label-caps text-[9px] bg-[#B98A3C]/10 text-[#B98A3C] border border-[#B98A3C]/20 px-2 py-0.5 rounded-full">
                        maybe
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invited section */}
          {invited.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-label-caps text-xs text-muted-text flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-outline-variant" />
                Invited ({invited.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {invited.map((member) => {
                  const mName = member.name || 'Guest';
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-card-cream border border-border-warm-grey px-4 py-3 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-container-high text-muted-text flex items-center justify-center font-headline-sm text-sm">
                          {mName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-body-md font-medium text-muted-text">{mName}</span>
                      </div>
                      <span className="font-label-caps text-[9px] text-muted-text bg-surface-container border border-border-warm-grey px-2 py-0.5 rounded-full">
                        pending
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Enter Trip Button */}
        <div className="pt-4">
          <Link
            href={`/trip/${tripId}/chat`}
            className="w-full flex items-center justify-center gap-2 bg-primary-container hover:bg-primary text-surface-container-lowest font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm transition duration-200"
          >
            Enter Trip Chat
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="none" />
    </div>
  );
}
