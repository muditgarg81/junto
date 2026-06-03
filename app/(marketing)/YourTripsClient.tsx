'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Link as LinkIcon, Calendar, Users, ArrowRight, Trash2 } from 'lucide-react';
import { User, Member } from '@/lib/types';
import { deleteTripAction } from '@/app/create-trip/actions';

interface DbTrip {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'done';
  base_currency: string;
  created_at: string;
  dates_payload: any;
  members: any; // Aggregated array from SQL
  is_creator: boolean;
}

interface YourTripsClientProps {
  user: User;
  dbTrips: DbTrip[];
}

export default function YourTripsClient({ user, dbTrips }: YourTripsClientProps) {
  const router = useRouter();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete the trip "${name}"? This action cannot be undone and will delete all expenses, plans, and itinerary details.`)) {
      return;
    }

    try {
      const res = await deleteTripAction(tripId);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete trip.');
    }
  };

  // Extract first name for greeting
  const firstName = user.name ? user.name.split(' ')[0] : 'there';

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) return;

    let token = inviteToken.trim();
    if (token.includes('/join/')) {
      const parts = token.split('/join/');
      token = parts[parts.length - 1];
    }
    token = token.replace(/[^a-zA-Z0-9-_]/g, '');

    if (token) {
      router.push(`/join/${token}`);
    } else {
      setJoinError('Invalid token format.');
    }
  };

  // Helper to get image based on trip name
  const getTripImage = (name: string) => {
    const nameLow = name.toLowerCase();
    if (nameLow.includes('goa')) {
      return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=150&q=80';
    } else if (nameLow.includes('venice')) {
      return 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=150&q=80';
    } else if (nameLow.includes('paris')) {
      return 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=150&q=80';
    } else if (nameLow.includes('rome')) {
      return 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=150&q=80';
    }
    // Fallback beautiful landscape
    return 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=150&q=80';
  };

  // Separate upcoming and past
  const upcomingTrips = dbTrips.filter((t) => t.status === 'planning' || t.status === 'active');
  const pastTrips = dbTrips.filter((t) => t.status === 'done');

  // Format dates payload
  const formatTripDates = (datesPayload: any) => {
    if (!datesPayload) return 'Dates TBD';
    
    let payload = datesPayload;
    if (typeof datesPayload === 'string') {
      try {
        payload = JSON.parse(datesPayload);
      } catch (e) {
        return 'Dates TBD';
      }
    }

    if (payload.startDate && payload.endDate) {
      const start = new Date(payload.startDate);
      const end = new Date(payload.endDate);
      
      const formatMonthDay = (d: Date) => {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
    }

    return 'Dates TBD';
  };

  // Safe fetch of members list
  const getMembersList = (membersField: any): { name: string; photo_url: string | null }[] => {
    if (!membersField) return [];
    if (typeof membersField === 'string') {
      try {
        return JSON.parse(membersField);
      } catch (e) {
        return [];
      }
    }
    if (Array.isArray(membersField)) {
      return membersField;
    }
    return [];
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-surface overflow-hidden max-w-md mx-auto border-x border-border-warm-grey shadow-sm pb-16">
      
      {/* Header Bar */}
      <header className="px-6 pt-8 pb-4 flex justify-between items-center z-10">
        <div>
          <h1 className="font-display text-4xl text-ink-text tracking-tight font-bold">
            Hi, {firstName}
          </h1>
          <p className="font-body-sm text-muted-text mt-0.5">Welcome back to Junto</p>
        </div>
        <Link
          href="/profile"
          className="w-11 h-11 rounded-full border-2 border-border-warm-grey shadow-sm bg-card-cream flex items-center justify-center font-display font-semibold text-primary overflow-hidden hover:scale-105 active:scale-95 transition duration-200"
          title="Account & Settings"
          id="your-trips-profile-avatar"
        >
          {user.photo_url ? (
            <img
              src={user.photo_url}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow px-6 py-4 space-y-8 z-10 overflow-y-auto">
        
        {/* Upcoming Trips */}
        <section className="space-y-3.5">
          <div className="flex justify-between items-center px-1">
            <h2 className="font-label-caps text-[11px] tracking-widest text-muted-text uppercase font-semibold">
              Upcoming Trips
            </h2>
            <span className="text-[10px] font-medium bg-[#ffdbcf] text-[#802901] px-2 py-0.5 rounded-full">
              {upcomingTrips.length} active
            </span>
          </div>

          {upcomingTrips.length === 0 ? (
            <div className="bg-card-cream border border-border-warm-grey/60 rounded-2xl p-6 text-center space-y-3 shadow-xs">
              <p className="font-body-md text-muted-text text-sm">
                No active or upcoming plans.
              </p>
              <Link
                href="/create-trip"
                className="inline-flex items-center gap-1.5 bg-primary-container text-surface-container-lowest font-body-sm px-4 py-2 rounded-xl hover:bg-primary transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Start a trip
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingTrips.map((trip) => {
                const members = getMembersList(trip.members);
                const isPlanning = trip.status === 'planning';
                return (
                  <Link
                    key={trip.id}
                    href={`/trip/${trip.id}/plan`}
                    className="block bg-card-cream border border-border-warm-grey hover:border-outline-variant rounded-2xl overflow-hidden shadow-xs hover:shadow-sm active:scale-[0.99] transition duration-150"
                  >
                    <div className="flex">
                      {/* Destination Thumbnail */}
                      <div className="w-24 h-24 relative flex-shrink-0">
                        <img
                          src={getTripImage(trip.name)}
                          alt={trip.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/10" />
                      </div>

                      {/* Card Details */}
                      <div className="p-4 flex-grow flex flex-col justify-between min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-headline-sm text-base text-ink-text font-bold truncate leading-tight">
                            {trip.name}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                isPlanning
                                  ? 'bg-ai-sage-tint text-primary-container border border-primary-container/20'
                                  : 'bg-[#ffe088] text-[#574500] border border-[#574500]/10'
                              }`}
                            >
                              {trip.status}
                            </span>
                            {trip.is_creator && (
                              <button
                                onClick={(e) => handleDeleteTrip(e, trip.id, trip.name)}
                                className="p-1.5 text-[#5e594e] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition duration-150 cursor-pointer"
                                title="Delete Trip"
                                aria-label={`Delete trip ${trip.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-muted-text">
                            <Calendar className="w-3.5 h-3.5 text-secondary" />
                            <span className="font-body-sm text-[11px] font-medium">
                              {formatTripDates(trip.dates_payload)}
                            </span>
                          </div>

                          {/* Member Overlapping Avatars */}
                          <div className="flex items-center">
                            <div className="flex -space-x-2 overflow-hidden mr-1">
                              {members.slice(0, 3).map((member, i) => (
                                <div
                                  key={i}
                                  className="inline-block h-6 w-6 rounded-full ring-2 ring-card-cream bg-surface-container-high text-[9px] font-bold flex items-center justify-center overflow-hidden text-muted-text"
                                >
                                  {member.photo_url ? (
                                    <img
                                      src={member.photo_url}
                                      alt={member.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    (member.name || 'G').charAt(0).toUpperCase()
                                  )}
                                </div>
                              ))}
                              {members.length > 3 && (
                                <div className="inline-block h-6 w-6 rounded-full ring-2 ring-card-cream bg-surface-container-high text-[9px] font-bold flex items-center justify-center text-muted-text">
                                  +{members.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Past Trips (Dimmed) */}
        {pastTrips.length > 0 && (
          <section className="space-y-3.5 opacity-60 hover:opacity-80 transition duration-300">
            <div className="px-1">
              <h2 className="font-label-caps text-[11px] tracking-widest text-muted-text uppercase font-semibold">
                Past Travels
              </h2>
            </div>

            <div className="space-y-3">
              {pastTrips.map((trip) => {
                const members = getMembersList(trip.members);
                return (
                  <Link
                    key={trip.id}
                    href={`/trip/${trip.id}/plan`}
                    className="block bg-card-cream/80 border border-border-warm-grey/60 rounded-2xl overflow-hidden shadow-xs hover:border-outline-variant hover:shadow-sm active:scale-[0.99] transition duration-150"
                  >
                    <div className="flex">
                      <div className="w-20 h-20 relative flex-shrink-0 filter grayscale-[20%]">
                        <img
                          src={getTripImage(trip.name)}
                          alt={trip.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/5" />
                      </div>

                      <div className="p-3.5 flex-grow flex flex-col justify-between min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-headline-sm text-sm text-ink-text font-bold truncate">
                            {trip.name}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[8px] font-bold uppercase tracking-wider bg-outline-variant/30 text-muted-text px-1.5 py-0.5 rounded-md border border-outline-variant/10">
                              done
                            </span>
                            {trip.is_creator && (
                              <button
                                onClick={(e) => handleDeleteTrip(e, trip.id, trip.name)}
                                className="p-1.5 text-[#5e594e] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition duration-150 cursor-pointer"
                                title="Delete Trip"
                                aria-label={`Delete trip ${trip.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1 text-muted-text">
                            <Calendar className="w-3 h-3 text-muted-text/75" />
                            <span className="font-body-sm text-[10px]">
                              {formatTripDates(trip.dates_payload)}
                            </span>
                          </div>

                          <span className="font-label-caps text-[9px] text-muted-text font-semibold">
                            {members.length} {members.length === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Secondary Buttons Row */}
        <section className="pt-2 space-y-3">
          {!showJoinInput ? (
            <div className="flex gap-3">
              <Link
                href="/create-trip"
                className="flex-grow flex items-center justify-center gap-1.5 border border-border-warm-grey hover:border-outline text-ink-text font-body-sm font-medium py-3 rounded-xl bg-card-cream/60 hover:bg-surface-container-low transition duration-150"
              >
                <Plus className="w-4 h-4 text-primary" />
                Start a trip
              </Link>

              <button
                onClick={() => setShowJoinInput(true)}
                className="flex-grow flex items-center justify-center gap-1.5 border border-border-warm-grey hover:border-outline text-ink-text font-body-sm font-medium py-3 rounded-xl bg-card-cream/60 hover:bg-surface-container-low transition duration-150"
              >
                <LinkIcon className="w-3.5 h-3.5 text-secondary" />
                Join with link
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-3 p-4 bg-card-cream border border-border-warm-grey rounded-2xl text-left animate-in fade-in slide-in-from-bottom-2 duration-200">
              <label className="block font-label-caps text-[10px] text-muted-text font-bold">
                Join Trip with Link or Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Invite token..."
                  value={inviteToken}
                  onChange={(e) => {
                    setInviteToken(e.target.value);
                    setJoinError('');
                  }}
                  className="flex-grow bg-surface border border-border-warm-grey focus:border-outline text-ink-text font-body-sm px-3.5 py-2 rounded-xl outline-none transition duration-150"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-primary-container hover:bg-primary text-surface-container-lowest p-2 rounded-xl shadow-xs transition duration-150"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {joinError && <p className="text-secondary text-xs">{joinError}</p>}
              <button
                type="button"
                onClick={() => {
                  setShowJoinInput(false);
                  setJoinError('');
                }}
                className="font-body-sm text-xs text-muted-text hover:text-ink-text underline"
              >
                Cancel
              </button>
            </form>
          )}
        </section>

      </main>

      {/* Dotted path design accent */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none opacity-5 z-0">
        <svg width="100%" height="80" viewBox="0 0 390 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-10,40 Q100,70 200,30 T400,50" stroke="#1f4d3f" strokeWidth="2" strokeDasharray="5 5"/>
        </svg>
      </div>

    </div>
  );
}
