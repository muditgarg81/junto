'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Home, Coins, Compass, Activity, Check, Plus, X, AlertCircle, Sparkles, BarChart2, ArrowRight, Trash2 } from 'lucide-react';
import ProposalCard from '@/components/ProposalCard';
import BottomNav from '@/components/BottomNav';
import { TripState, Decision, Option } from '@/lib/types';
import Link from 'next/link';
import OfferCard from '@/components/OfferCard';
import { EmergencyShieldButton } from '@/components/EmergencyShieldButton';

interface PlanClientProps {
  initialState: TripState;
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
}

export default function PlanClient({ initialState, currentMember }: PlanClientProps) {
  const router = useRouter();
  const [data, setData] = useState<TripState>(initialState);
  const [showModal, setShowModal] = useState(false);
  const [proposalType, setProposalType] = useState<'hotel' | 'dates' | 'budget' | 'destination' | 'logistics' | 'custom'>('custom');
  const [proposalTitle, setProposalTitle] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDecidedDecision, setSelectedDecidedDecision] = useState<(Decision & { options: Option[]; votes: any[] }) | null>(null);

  const { trip, members, decisions } = data;
  const tripId = trip.id;
  const currentMemberId = currentMember?.memberId || null;

  // Realtime Polling Sync (every 3 seconds)
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trip/${tripId}/sync`);
        if (!res.ok) throw new Error('Sync failed');
        const updatedData = await res.json();
        if (active) {
          setData(updatedData);
        }
      } catch (err) {
        console.error('Error polling sync:', err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tripId]);

  // Handle vote action
  const handleVote = async (decisionId: string, optionId: string, value: 'yes' | 'no') => {
    if (!currentMemberId) {
      alert('You must join this trip to vote.');
      return;
    }

    try {
      const res = await fetch(`/api/trip/${tripId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          decisionId,
          optionId,
          memberId: currentMemberId,
          value,
        }),
      });

      if (!res.ok) throw new Error('Voting failed');

      // Optimistic local update
      setData((prev) => {
        const updatedDecisions = prev.decisions.map((dec) => {
          if (dec.id !== decisionId) return dec;
          const otherVotes = dec.votes.filter(
            (v) => !(v.option_id === optionId && v.member_id === currentMemberId)
          );
          return {
            ...dec,
            votes: [
              ...otherVotes,
              {
                id: crypto.randomUUID(),
                decision_id: decisionId,
                option_id: optionId,
                member_id: currentMemberId,
                value,
                created_at: new Date().toISOString(),
              },
            ],
          };
        });
        return { ...prev, decisions: updatedDecisions };
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit vote.');
    }
  };

  // Handle lock action
  const handleLock = async (decisionId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/trip/${tripId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lock',
          decisionId,
          optionId,
          memberId: currentMemberId,
        }),
      });

      if (!res.ok) throw new Error('Locking decision failed');

      // Refresh data
      const syncRes = await fetch(`/api/trip/${tripId}/sync`);
      if (syncRes.ok) {
        setData(await syncRes.json());
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to lock decision.');
    }
  };

  // Handle delete/unlock decision action
  const handleDeleteDecision = async (decisionId: string) => {
    if (!confirm('Are you sure you want to delete this decided plan item? This will delete the decision, all its options, and votes permanently.')) return;
    
    try {
      const res = await fetch(`/api/trip/${tripId}/proposal`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId })
      });
      if (res.ok) {
        // Refresh data
        const syncRes = await fetch(`/api/trip/${tripId}/sync`);
        if (syncRes.ok) {
          setData(await syncRes.json());
        }
      } else {
        alert('Failed to delete decision.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete decision.');
    }
  };

  // Handle create proposal
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTitle.trim()) return;

    const filteredOptions = options.filter((o) => o.trim() !== '');
    if (filteredOptions.length === 0) {
      alert('Please add at least one option.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/trip/${tripId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          type: proposalType,
          title: proposalTitle,
          options: filteredOptions.map((label) => ({ label, payload: {} })),
          proposedBy: currentMemberId,
        }),
      });

      if (!res.ok) throw new Error('Failed to create proposal');

      // Clean form and close
      setProposalTitle('');
      setOptions(['', '']);
      setShowModal(false);

      // Refresh data
      const syncRes = await fetch(`/api/trip/${tripId}/sync`);
      if (syncRes.ok) {
        setData(await syncRes.json());
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to create proposal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add an option input field in form
  const addOptionField = () => setOptions([...options, '']);

  // Remove an option input field
  const removeOptionField = (index: number) => {
    if (options.length <= 1) return;
    setOptions(options.filter((_, idx) => idx !== index));
  };

  // Update option label at index
  const updateOptionValue = (index: number, val: string) => {
    setOptions(options.map((item, idx) => (idx === index ? val : item)));
  };

  // Helper icon selector for decided decisions
  const getDecisionIcon = (type: string) => {
    switch (type) {
      case 'dates':
        return <Calendar className="w-5 h-5 text-[#1f4d3f]" />;
      case 'destination':
        return <MapPin className="w-5 h-5 text-[#1f4d3f]" />;
      case 'hotel':
        return <Home className="w-5 h-5 text-[#1f4d3f]" />;
      case 'budget':
        return <Coins className="w-5 h-5 text-[#1f4d3f]" />;
      case 'logistics':
        return <Compass className="w-5 h-5 text-[#1f4d3f]" />;
      default:
        return <Activity className="w-5 h-5 text-[#1f4d3f]" />;
    }
  };

  // Compute roster tallies
  const goingCount = members.filter((m) => m.status === 'confirmed').length;
  const maybeCount = members.filter((m) => m.status === 'maybe').length;

  const decidedDecisions = decisions.filter((d) => d.status === 'locked');
  const openDecisions = decisions.filter((d) => d.status === 'open');

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      {/* Read-only Banner for guests who haven't joined yet */}
      {!currentMemberId && (
        <div className="bg-secondary/10 border-b border-secondary/20 px-6 py-3 flex items-center justify-between text-xs text-secondary font-medium z-20">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Viewing plan as reader.
          </span>
          <Link
            href={`/join/${trip.invite_token}`}
            className="font-bold underline hover:text-red-800 transition"
          >
            Join Trip
          </Link>
        </div>
      )}

      {/* Plan Page Content */}
      <div className="flex-grow px-6 py-6 space-y-8 z-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-left">
              <h1 className="font-display text-4xl text-ink-text leading-tight font-bold truncate max-w-[150px] md:max-w-[180px]" title={trip.name}>
                {trip.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-body-sm text-xs font-semibold text-primary">
                  Plan
                </span>
                {data.isBoosted ? (
                  <span className="bg-[#1f4d3f]/10 text-[#1f4d3f] border border-[#1f4d3f]/20 font-bold px-2 py-0.5 rounded-full font-label-caps text-[9px] flex items-center gap-0.5 shadow-xs shrink-0 animate-pulse">
                    <Sparkles className="w-2.5 h-2.5" /> BOOSTED
                  </span>
                ) : (
                  <Link
                    href={`/trip/${tripId}/upgrade`}
                    className="bg-secondary/10 hover:bg-secondary/20 text-[#C2592F] border border-[#C2592F]/20 font-bold px-2 py-0.5 rounded-full font-label-caps text-[9px] flex items-center gap-0.5 shadow-xs shrink-0 transition"
                  >
                    ⚡ BOOST
                  </Link>
                )}
                <span className="text-[10px] text-muted-text font-body-sm shrink-0">
                  · {goingCount} going {maybeCount > 0 && `· ${maybeCount} maybe`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EmergencyShieldButton tripId={tripId} />
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
            {currentMemberId && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-primary-container hover:bg-primary text-surface p-2.5 rounded-full shadow-sm hover:scale-105 transition-transform duration-200"
                title="New Proposal"
              >
                <Plus className="w-5.5 h-5.5" />
              </button>
            )}
          </div>
        </div>

        {/* DECIDED SECTION */}
        <div className="space-y-3">
          <h2 className="font-label-caps text-xs text-muted-text tracking-wider">DECIDED</h2>

          {decidedDecisions.length === 0 ? (
            <div className="bg-card-cream/60 border border-dashed border-border-warm-grey rounded-2xl p-6 text-center text-muted-text font-body-sm">
              No decisions locked yet. Group votes seal the deal!
            </div>
          ) : (
            <div className="space-y-2">
              {decidedDecisions.map((dec) => {
                const resolvedOpt = dec.options.find((o) => o.id === dec.resolved_option_id);
                return (
                  <div
                    key={dec.id}
                    onClick={() => setSelectedDecidedDecision(dec as any)}
                    className="flex items-center justify-between bg-card-cream border border-border-warm-grey p-4 rounded-xl shadow-sm cursor-pointer hover:border-outline transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-ai-sage-tint flex items-center justify-center shrink-0">
                        {getDecisionIcon(dec.type)}
                      </div>
                      <div>
                        <h3 className="font-body-md font-semibold text-ink-text leading-tight group-hover:text-primary-container transition">
                          {resolvedOpt?.label || dec.title}
                        </h3>
                        <p className="font-body-sm text-muted-text text-xs">
                          {dec.title} · Locked
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentMemberId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDecision(dec.id);
                          }}
                          className="p-1.5 text-muted-text hover:text-secondary hover:bg-secondary/10 rounded-lg transition"
                          title="Delete Decision"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      )}
                      <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-surface shrink-0 shadow-sm">
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* OPEN SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-label-caps text-xs text-muted-text tracking-wider">OPEN PROPOSALS</h2>
            {currentMemberId && openDecisions.length > 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="font-label-caps text-[11px] text-secondary font-bold hover:underline"
              >
                + Propose
              </button>
            )}
          </div>

          {openDecisions.length === 0 ? (
            <div className="bg-card-cream/60 border border-dashed border-border-warm-grey rounded-2xl p-6 text-center text-muted-text font-body-sm">
              No open proposals. Propose something new to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {openDecisions.map((dec) => (
                <ProposalCard
                  key={dec.id}
                  decision={dec}
                  members={members}
                  currentMemberId={currentMemberId}
                  onVote={handleVote}
                  onLock={handleLock}
                  offers={data.offers}
                />
              ))}
            </div>
          )}
        </div>

        {/* TRIP RESOURCES */}
        <div className="space-y-3">
          <h2 className="font-label-caps text-xs text-muted-text tracking-wider text-left">TRIP RESOURCES</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/trip/${tripId}/itinerary`}
              className="flex items-center gap-3.5 bg-card-cream border border-border-warm-grey p-4 rounded-xl shadow-xs hover:border-outline hover:scale-[1.01] active:scale-[0.99] transition group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1f4d3f]/10 flex items-center justify-center text-[#1f4d3f] group-hover:text-secondary transition shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-body-md font-semibold text-ink-text text-sm leading-tight">Itinerary</h4>
                <p className="text-[10px] text-muted-text font-body-sm mt-0.5">Timeline schedule</p>
              </div>
            </Link>

            <Link
              href={`/trip/${tripId}/checklist`}
              className="flex items-center gap-3 bg-card-cream border border-border-warm-grey p-4 rounded-xl shadow-xs hover:border-outline hover:scale-[1.01] active:scale-[0.99] transition group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1f4d3f]/10 flex items-center justify-center text-[#1f4d3f] group-hover:text-secondary transition shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-body-md font-semibold text-ink-text text-sm leading-tight">Essentials</h4>
                <p className="text-[10px] text-muted-text font-body-sm mt-0.5">Packing checklist</p>
              </div>
            </Link>

            <Link
              href={`/trip/${tripId}/local-info`}
              className="flex items-center gap-3 bg-card-cream border border-border-warm-grey p-4 rounded-xl shadow-xs hover:border-outline hover:scale-[1.01] active:scale-[0.99] transition group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1f4d3f]/10 flex items-center justify-center text-[#1f4d3f] group-hover:text-secondary transition shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-body-md font-semibold text-ink-text text-sm leading-tight">Local Info</h4>
                <p className="text-[10px] text-muted-text font-body-sm mt-0.5">Emergency SOS</p>
              </div>
            </Link>

            <Link
              href={`/profile/sharing`}
              className="flex items-center gap-3 bg-card-cream border border-border-warm-grey p-4 rounded-xl shadow-xs hover:border-outline hover:scale-[1.01] active:scale-[0.99] transition group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1f4d3f]/10 flex items-center justify-center text-[#1f4d3f] group-hover:text-secondary transition shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-body-md font-semibold text-ink-text text-sm leading-tight">Memories</h4>
                <p className="text-[10px] text-muted-text font-body-sm mt-0.5">Digital scrapbook</p>
              </div>
            </Link>
          </div>
        </div>

        {/* WHO'S IN SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-label-caps text-xs text-muted-text tracking-wider">WHO&apos;S IN</h2>
            <Link
              href={`/trip/${tripId}/invite`}
              className="font-label-caps text-[11px] text-primary-container font-bold hover:underline"
            >
              Manage link
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const isGoing = member.status === 'confirmed';
              const isMaybe = member.status === 'maybe';
              const dotColor = isGoing ? 'bg-[#1f4d3f]' : isMaybe ? 'bg-[#B98A3C]' : 'bg-outline-variant';

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-1.5 bg-card-cream border border-border-warm-grey px-3 py-1.5 rounded-full text-xs font-body-md text-ink-text shadow-sm"
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span>{member.name}</span>
                  {member.roles.includes('organizer') && (
                    <span className="text-[8px] bg-primary-container/10 text-[#1f4d3f] border border-[#1f4d3f]/20 rounded-full px-1 py-0.2 ml-0.5">
                      Org
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOOKING OPTIONS (SPONSORED) */}
        {data.offers && data.offers.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-label-caps text-xs text-muted-text tracking-wider">BOOKING OPTIONS</h2>
            <div className="space-y-3">
              {data.offers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} currentMemberId={currentMemberId} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CREATE PROPOSAL MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-text/30 backdrop-blur-xs flex items-center justify-center z-50 p-6 animate-fade-in">
          <div className="bg-surface max-w-sm w-full rounded-2xl border border-border-warm-grey shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-ink-text">Create proposal</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-text hover:text-ink-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-4 text-left">
              {/* Proposal Type */}
              <div className="space-y-1.5">
                <label className="block font-label-caps text-muted-text text-[10px]">Type</label>
                <select
                  value={proposalType}
                  onChange={(e: any) => setProposalType(e.target.value)}
                  className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-3 outline-none"
                >
                  <option value="hotel">Hotel</option>
                  <option value="dates">Dates</option>
                  <option value="budget">Budget</option>
                  <option value="destination">Destination</option>
                  <option value="logistics">Logistics</option>
                  <option value="custom">Custom Plan</option>
                </select>
              </div>

              {/* Proposal Title */}
              <div className="space-y-1.5">
                <label className="block font-label-caps text-muted-text text-[10px]">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Hotel Stay, Goa Dates"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  required
                  className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-3 outline-none focus:border-outline"
                />
              </div>

              {/* Options Dynamic List */}
              <div className="space-y-2">
                <label className="block font-label-caps text-muted-text text-[10px]">Options</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1} label`}
                        value={opt}
                        onChange={(e) => updateOptionValue(idx, e.target.value)}
                        required
                        className="flex-grow bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl px-3 py-2 outline-none focus:border-outline text-sm"
                      />
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOptionField(idx)}
                          className="text-secondary hover:text-red-700 p-1.5 hover:bg-surface-container rounded-lg transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOptionField}
                  className="font-body-sm text-xs text-primary-container font-semibold hover:text-primary flex items-center gap-1 mt-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-border-warm-grey text-muted-text hover:text-ink-text py-3 rounded-xl font-body-md font-medium text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary-container hover:bg-primary text-surface font-body-md font-semibold py-3 rounded-xl text-center shadow-sm"
                >
                  {isSubmitting ? 'Proposing...' : 'Propose'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECIDED DETAILS MODAL */}
      {selectedDecidedDecision && (
        <div className="fixed inset-0 bg-ink-text/30 backdrop-blur-xs flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-surface max-w-sm w-full rounded-2xl border border-border-warm-grey shadow-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[10px] text-secondary tracking-wider">
                DECIDED PLAN DETAILS
              </span>
              <button 
                onClick={() => setSelectedDecidedDecision(null)}
                className="text-muted-text hover:text-ink-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <h3 className="font-headline-sm text-ink-text leading-tight">{selectedDecidedDecision.title}</h3>
                <p className="font-body-sm text-xs text-muted-text">
                  Category: {selectedDecidedDecision.type.toUpperCase()} · Locked
                </p>
              </div>

              {/* Resolved Option details */}
              {(() => {
                const resolvedOpt = selectedDecidedDecision.options.find(
                  (o) => o.id === selectedDecidedDecision.resolved_option_id
                );
                if (!resolvedOpt) return null;

                const proposedByName = members.find((m) => m.id === resolvedOpt.proposed_by)?.name || 'Organizer';
                
                // Show vote breakdown for this resolved option
                const optionVotes = selectedDecidedDecision.votes.filter(
                  (v) => v.option_id === resolvedOpt.id
                );

                return (
                  <div className="space-y-4">
                    <div className="bg-card-cream border border-border-warm-grey rounded-xl p-4 space-y-2">
                      <span className="font-label-caps text-[9px] bg-primary-container text-surface px-2 py-0.5 rounded-md inline-block font-bold">
                        Locked Choice
                      </span>
                      <h4 className="font-body-md font-semibold text-ink-text">{resolvedOpt.label}</h4>
                      <p className="font-body-sm text-xs text-muted-text">
                        Proposed by {proposedByName}
                      </p>
                    </div>

                    {/* Vote details lists */}
                    <div className="space-y-2">
                      <span className="font-label-caps text-[9px] text-muted-text font-bold">Group Vote Breakdown</span>
                      <div className="max-h-32 overflow-y-auto space-y-1.5 border border-border-warm-grey/50 rounded-xl p-3 bg-surface/30">
                        {members.map((m) => {
                          const vote = optionVotes.find((v) => v.member_id === m.id);
                          const voteVal = vote ? vote.value : 'pending';
                          return (
                            <div key={m.id} className="flex justify-between items-center text-xs">
                              <span className="font-body-sm font-medium text-ink-text">{m.name}</span>
                              <span className={`font-label-caps text-[10px] font-bold ${
                                voteVal === 'yes' 
                                  ? 'text-primary-container' 
                                  : voteVal === 'no' 
                                  ? 'text-secondary' 
                                  : 'text-muted-text'
                              }`}>
                                {voteVal === 'yes' ? 'Confirmed ✓' : voteVal === 'no' ? 'Objected ✗' : 'No Vote'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDecidedDecision(null)}
                  className="flex-1 border border-border-warm-grey text-muted-text hover:text-ink-text py-2.5 rounded-xl font-body-sm font-medium text-center"
                >
                  Close
                </button>
                {currentMemberId && (
                  <button
                    type="button"
                    onClick={async () => {
                      const id = selectedDecidedDecision.id;
                      setSelectedDecidedDecision(null);
                      await handleDeleteDecision(id);
                    }}
                    className="flex-1 border border-secondary/35 text-secondary hover:bg-secondary/5 font-body-sm font-semibold py-2.5 rounded-xl text-center flex items-center justify-center gap-1.5 transition"
                  >
                    Delete Plan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav tripId={tripId} activeTab="plan" />
    </div>
  );
}
