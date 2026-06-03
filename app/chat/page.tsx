'use strict';

import React from 'react';
import { query } from '@/lib/db';
import { Trip } from '@/lib/types';
import Link from 'next/link';
import { MessageSquare, ArrowRight, Folder } from 'lucide-react';

export default async function GeneralChatPage() {
  // Fetch all trips alongside their chat message count
  const tripsRes = await query(`
    SELECT t.*, COUNT(m.id) as message_count
    FROM trips t
    LEFT JOIN messages m ON t.id = m.trip_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  const trips = tripsRes.rows;

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-8 space-y-8 pb-24 z-10">
        
        {/* Header */}
        <div>
          <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Group Chats</h1>
          <p className="font-body-sm text-muted-text">Select a trip to enter its planning discussion</p>
        </div>

        {/* Trips List */}
        <div className="space-y-4">
          {trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-3 opacity-60">
              <MessageSquare className="w-12 h-12 text-[#1f4d3f]" />
              <p className="font-body-sm text-sm text-muted-text">
                No active trips. Start a trip to begin chatting.
              </p>
              <Link
                href="/create-trip"
                className="bg-[#1f4d3f] hover:bg-primary text-surface font-body-sm font-semibold py-2.5 px-5 rounded-xl shadow-xs transition"
              >
                Create a Trip
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => {
                const count = parseInt(trip.message_count, 10);
                return (
                  <Link
                    key={trip.id}
                    href={`/trip/${trip.id}/chat`}
                    className="block bg-card-cream border border-border-warm-grey hover:border-outline rounded-2xl p-5 shadow-xs transition group text-left"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1.5">
                        <h3 className="font-body-lg font-bold text-ink-text group-hover:text-[#1f4d3f] transition">
                          {trip.name}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-text font-body-sm">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-[#1f4d3f]" />
                            {count} {count === 1 ? 'message' : 'messages'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-label-caps uppercase ${
                            trip.status === 'active'
                              ? 'bg-[#1f4d3f]/10 text-[#1f4d3f]'
                              : trip.status === 'planning'
                              ? 'bg-[#B98A3C]/10 text-[#B98A3C]'
                              : 'bg-outline-variant/20 text-muted-text'
                          }`}>
                            {trip.status}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 border border-border-warm-grey rounded-full bg-surface group-hover:bg-[#1f4d3f]/5 transition text-muted-text group-hover:text-[#1f4d3f] shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Nav back home */}
      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <Link href="/" className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold">
          ← Back Home
        </Link>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Chat Hub</span>
      </footer>
    </div>
  );
}
