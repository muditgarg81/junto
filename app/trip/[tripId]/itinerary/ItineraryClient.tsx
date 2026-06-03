'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Plane,
  Home,
  Compass,
  Info,
  AlertTriangle,
  AlertCircle,
  Plus,
  X,
  Trash2,
  Clock,
  MapPin
} from 'lucide-react';
import { Trip, Member, ItineraryItem } from '@/lib/types';
import { checkItineraryConflicts, ItineraryConflict } from '@/lib/itinerary-checker';
import { addItineraryItemAction, deleteItineraryItemAction } from './actions';
import { EmergencyShieldButton } from '@/components/EmergencyShieldButton';
import BottomNav from '@/components/BottomNav';

interface ItineraryClientProps {
  trip: Trip;
  members: Member[];
  initialItineraryItems: ItineraryItem[];
  datesPayload: any;
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
}

export default function ItineraryClient({
  trip,
  members,
  initialItineraryItems,
  datesPayload,
  currentMember
}: ItineraryClientProps) {
  const router = useRouter();
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>(initialItineraryItems);
  const [isPending, startTransition] = useTransition();

  // Modal open state
  const [showAddModal, setShowAddModal] = useState(false);

  // Form fields state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'flight' | 'stay' | 'activity' | 'other'>('activity');
  const [location, setLocation] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Realtime Polling Sync (every 3 seconds)
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trip/${trip.id}/sync`);
        if (!res.ok) throw new Error('Sync failed');
        const data = await res.json();
        if (active && data.itineraryItems) {
          setItineraryItems(data.itineraryItems);
        }
      } catch (err) {
        console.error('Error polling itinerary:', err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [trip.id]);

  // Keep local state in sync when initial items change
  useEffect(() => {
    setItineraryItems(initialItineraryItems);
  }, [initialItineraryItems]);

  // Parse trip date limits for form validation
  let tripStartStr = '';
  let tripEndStr = '';
  if (datesPayload) {
    let payload = datesPayload;
    if (typeof datesPayload === 'string') {
      try {
        payload = JSON.parse(datesPayload);
      } catch (e) {}
    }
    if (payload.startDate) tripStartStr = payload.startDate;
    if (payload.endDate) tripEndStr = payload.endDate;
  }

  // Pre-fill date when modal opens
  const openModal = () => {
    setTitle('');
    // Default to trip start date or current date
    setDate(tripStartStr || new Date().toISOString().split('T')[0]);
    setTime('');
    setType('activity');
    setLocation('');
    setErrorMsg(null);
    setShowAddModal(true);
  };

  // Conflicts calculation
  const conflicts = checkItineraryConflicts(itineraryItems);

  // Group itinerary items by date
  const groupedItems: Record<string, ItineraryItem[]> = {};
  itineraryItems.forEach((item) => {
    const dStr = typeof item.date === 'string'
      ? item.date.split('T')[0]
      : new Date(item.date).toISOString().split('T')[0];
    if (!groupedItems[dStr]) {
      groupedItems[dStr] = [];
    }
    groupedItems[dStr].push(item);
  });

  // Sort unique dates chronologically
  const sortedDates = Object.keys(groupedItems).sort();

  // Helper to format date display (e.g. DAY 1 · Friday, June 5)
  const getDayHeader = (dateStr: string, index: number) => {
    const dateObj = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateFormatted = dateObj.toLocaleDateString('en-US', options);
    return `DAY ${index + 1} · ${dateFormatted.toUpperCase()}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'flight':
        return <Plane className="w-4 h-4 text-[#1f4d3f]" />;
      case 'stay':
        return <Home className="w-4 h-4 text-[#1f4d3f]" />;
      case 'activity':
        return <Compass className="w-4 h-4 text-[#1f4d3f]" />;
      default:
        return <Calendar className="w-4 h-4 text-[#1f4d3f]" />;
    }
  };

  // Helper to check if an item is involved in a conflict
  const findConflictForItem = (itemId: string): ItineraryConflict | undefined => {
    return conflicts.find(c => c.item1.id === itemId || c.item2.id === itemId);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || !date) {
      setErrorMsg('Please enter a title and select a date.');
      return;
    }

    startTransition(async () => {
      const res = await addItineraryItemAction(trip.id, {
        title,
        date,
        time: time && time.trim() !== '' ? time : null,
        type,
        location: location && location.trim() !== '' ? location : null
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setShowAddModal(false);
        router.refresh();
      }
    });
  };

  const handleDeleteEvent = async (e: React.MouseEvent, itemId: string, eventName: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Remove "${eventName}" from your timeline?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteItineraryItemAction(trip.id, itemId);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm pb-16">
      
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/trip/${trip.id}/vault`} className="text-ink-text hover:text-secondary transition p-1">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Timeline</h1>
                <span className="font-body-sm text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold shrink-0">
                  {trip.name}
                </span>
              </div>
              <p className="font-body-sm text-muted-text">Chronological trip schedule & travel connections</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EmergencyShieldButton tripId={trip.id} />
            {currentMember && (
              <Link
                href="/profile"
                className="w-8 h-8 rounded-full border border-border-warm-grey shadow-xs bg-card-cream flex items-center justify-center font-display font-semibold text-primary overflow-hidden hover:scale-105 active:scale-95 transition shrink-0"
                title="Account & Settings"
              >
                {currentMember.photoUrl ? (
                  <img
                    src={currentMember.photoUrl}
                    alt={currentMember.memberName || 'Profile'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (currentMember.memberName || 'F').charAt(0).toUpperCase()
                )}
              </Link>
            )}
            <button
              onClick={openModal}
              className="bg-primary-container hover:bg-primary text-surface p-2.5 rounded-full shadow-sm hover:scale-105 transition-transform"
              title="Add Timeline Event"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conflict summary banners at top */}
        {conflicts.length > 0 && (
          <div className="space-y-2.5">
            {conflicts.map((conflict, idx) => (
              <div key={idx} className="bg-secondary/10 border border-[#C2592F]/30 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#C2592F] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-label-caps text-[10px] text-[#C2592F] font-bold">
                    {conflict.type === 'overlap' ? 'OVERLAPPING EVENTS' : 'TIGHT CONNECTION WARNING'}
                  </span>
                  <p className="font-body-sm text-xs text-ink-text leading-relaxed text-left">
                    {conflict.type === 'overlap' 
                      ? `"${conflict.item1.title}" and "${conflict.item2.title}" are scheduled at the same time.`
                      : `Only ${conflict.gapMinutes} minutes between "${conflict.item1.title}" and "${conflict.item2.title}".`
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TIMELINE LIST */}
        <div className="space-y-8">
          {sortedDates.length === 0 ? (
            <div className="bg-card-cream/60 border border-dashed border-border-warm-grey rounded-2xl p-8 text-center text-muted-text font-body-sm space-y-4">
              <p>Your itinerary is empty. Manually add events or upload bookings to populate your timeline!</p>
              <button
                onClick={openModal}
                className="bg-primary-container hover:bg-primary text-surface text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition"
              >
                Add Timeline Event
              </button>
            </div>
          ) : (
            sortedDates.map((dateStr, dateIdx) => {
              const dayItems = groupedItems[dateStr];
              
              return (
                <div key={dateStr} className="space-y-4">
                  {/* Day Header */}
                  <h2 className="font-display font-bold text-base text-ink-text border-b border-border-warm-grey pb-1 mt-6 text-left">
                    {getDayHeader(dateStr, dateIdx)}
                  </h2>

                  {/* Daily items */}
                  <div className="relative pl-6 space-y-6 border-l border-border-warm-grey/60 ml-3">
                    {dayItems.map((item) => {
                      const itemConflict = findConflictForItem(item.id);
                      const isConflicted = !!itemConflict;

                      // Format display time
                      let displayTime = 'Time TBD';
                      if (item.time) {
                        const parts = item.time.split(':');
                        const h = parseInt(parts[0], 10);
                        const m = parts[1];
                        const suffix = h >= 12 ? 'PM' : 'AM';
                        const h12 = h % 12 || 12;
                        displayTime = `${h12}:${m} ${suffix}`;
                      }

                      const cardContent = (
                        <div className={`bg-card-cream border p-4 rounded-xl shadow-xs space-y-1 transition duration-200 text-left ${
                          isConflicted ? 'border-[#C2592F] hover:shadow-sm' : 'border-border-warm-grey hover:border-outline'
                        } ${item.source_vault_item_id ? 'cursor-pointer hover:scale-[1.01]' : ''}`}>
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-body-md font-semibold text-ink-text leading-tight">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[10px] text-muted-text bg-[#fff9ed] border border-border-warm-grey/50 px-2 py-0.5 rounded">
                                {displayTime}
                              </span>
                              {!item.source_vault_item_id && (
                                <button
                                  onClick={(e) => handleDeleteEvent(e, item.id, item.title)}
                                  className="text-muted-text hover:text-[#ba1a1a] hover:bg-[#ffdad6] p-1 rounded-lg transition"
                                  title="Delete Event"
                                  disabled={isPending}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {item.location && (
                            <p className="font-body-sm text-xs text-muted-text flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-text/75" />
                              <span>{item.location}</span>
                            </p>
                          )}

                          {/* Small warnings directly inline */}
                          {isConflicted && (
                            <div className="flex items-center gap-1 text-[10px] text-[#C2592F] font-semibold pt-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>
                                {itemConflict.type === 'overlap' ? 'Overlaps other event' : `Tight transfer: ${itemConflict.gapMinutes}m`}
                              </span>
                            </div>
                          )}

                          {/* Source Voucher indicator */}
                          {item.source_vault_item_id && (
                            <div className="flex items-center gap-1 text-[9px] text-muted-text pt-1.5 opacity-70">
                              <Info className="w-3 h-3 text-[#1f4d3f]" />
                              <span>Details linked to Vault Voucher (Click to view)</span>
                            </div>
                          )}
                        </div>
                      );

                      return (
                        <div key={item.id} className="relative group">
                          {/* Circle dot on timeline */}
                          <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border bg-surface flex items-center justify-center shadow-xs transition-colors duration-300 ${
                            isConflicted 
                              ? 'border-[#C2592F] bg-secondary/10' 
                              : 'border-border-warm-grey bg-[#fff9ed]'
                          }`}>
                            {getEventIcon(item.type)}
                          </div>

                          {item.source_vault_item_id ? (
                            <Link href={`/trip/${trip.id}/vault?open=${item.source_vault_item_id}`}>
                              {cardContent}
                            </Link>
                          ) : (
                            cardContent
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Timeline Event Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-text/30 backdrop-blur-xs">
          {/* Backdrop Closer */}
          <div className="absolute inset-0" onClick={() => setShowAddModal(false)} />

          <div className="bg-surface max-w-sm w-full rounded-2xl border border-border-warm-grey shadow-lg p-6 space-y-4 text-left z-10 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-sm text-ink-text font-bold">Add Event</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-text hover:text-ink-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <p className="bg-[#ffdad6] text-[#ba1a1a] text-xs font-semibold px-3 py-2 rounded-lg border border-[#ffb4ab]">
                {errorMsg}
              </p>
            )}

            <form onSubmit={handleAddEvent} className="space-y-4">
              
              {/* Event Title */}
              <div className="space-y-1">
                <label className="block text-[10px] font-label-caps text-muted-text font-bold">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunset Scuba Diving, Hotel Check-in"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-sm px-3.5 py-2.5 rounded-xl outline-none"
                />
              </div>

              {/* Event Date */}
              <div className="space-y-1">
                <label className="block text-[10px] font-label-caps text-muted-text font-bold">Date *</label>
                <input
                  type="date"
                  required
                  min={tripStartStr || undefined}
                  max={tripEndStr || undefined}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-sm px-3.5 py-2.5 rounded-xl outline-none cursor-pointer"
                />
                {tripStartStr && tripEndStr && (
                  <p className="text-[9px] text-muted-text">
                    Trip dates: {new Date(tripStartStr).toLocaleDateString()} to {new Date(tripEndStr).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Event Time (Optional) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-label-caps text-muted-text font-bold">Time (Optional)</label>
                <div className="relative">
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-sm px-3.5 py-2.5 rounded-xl outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Event Type */}
              <div className="space-y-1">
                <label className="block text-[10px] font-label-caps text-muted-text font-bold">Event Category</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-sm px-3.5 py-2.5 rounded-xl outline-none cursor-pointer"
                >
                  <option value="activity">Compass (Activity/Sightseeing)</option>
                  <option value="flight">Plane (Travel Connection/Flight)</option>
                  <option value="stay">Home (Accommodation/Hotel)</option>
                  <option value="other">Calendar (Other Event)</option>
                </select>
              </div>

              {/* Location (Optional) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-label-caps text-muted-text font-bold">Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Baga Beach, Goa"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-sm px-3.5 py-2.5 rounded-xl outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border border-border-warm-grey hover:bg-surface-container text-muted-text font-body-sm py-3 rounded-xl transition cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-primary-container hover:bg-primary text-surface font-body-sm font-semibold py-3 rounded-xl shadow-sm transition cursor-pointer text-center"
                >
                  {isPending ? 'Adding...' : 'Add Event'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav tripId={trip.id} activeTab="none" />
    </div>
  );
}
