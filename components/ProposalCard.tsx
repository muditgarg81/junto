'use strict';

'use client';

import React from 'react';
import { Check, X, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { Member, Decision, Option, Vote, Offer } from '@/lib/types';

interface ProposalCardProps {
  decision: Decision & { options: Option[]; votes: Vote[] };
  members: Member[];
  currentMemberId: string | null;
  onVote: (decisionId: string, optionId: string, value: 'yes' | 'no') => Promise<void>;
  onLock: (decisionId: string, optionId: string) => Promise<void>;
  offers?: Offer[];
}

export default function ProposalCard({
  decision,
  members,
  currentMemberId,
  onVote,
  onLock,
  offers = []
}: ProposalCardProps) {
  const activeMembers = members.filter((m) => m.status === 'confirmed' || m.status === 'maybe');
  const totalMemberCount = activeMembers.length;

  const [nudgedOptions, setNudgedOptions] = React.useState<Record<string, boolean>>({});

  const handleNudge = async (pendingMembers: Member[], optionLabel: string, optionId: string) => {
    if (nudgedOptions[optionId]) return;

    const nudgeNames = pendingMembers.map(m => `@${m.name}`).join(', ');
    const messageText = `Hey ${nudgeNames} - please vote on "${optionLabel}" for "${decision.title}"!`;

    try {
      const res = await fetch(`/api/trip/${decision.trip_id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentMemberId,
          body: messageText
        })
      });
      if (res.ok) {
        setNudgedOptions(prev => ({ ...prev, [optionId]: true }));
      } else {
        alert('Failed to send nudge.');
      }
    } catch (err) {
      console.error('Error sending nudge:', err);
      alert('Failed to send nudge.');
    }
  };

  const hotelOffers = decision.type === 'hotel' 
    ? offers.filter(o => o.category === 'hotel') 
    : [];

  return (
    <div className="bg-card-cream border-t-2 border-t-secondary border-x border-b border-border-warm-grey rounded-2xl p-5 shadow-sm space-y-4">
      {/* Uppercase Tag & Status */}
      <div className="flex items-center justify-between">
        <span className="font-label-caps text-[10px] text-secondary tracking-wider">
          PROPOSAL · {decision.type}
        </span>
        <span className="font-label-caps text-[9px] bg-secondary/15 text-secondary px-2.5 py-0.5 rounded-full">
          voting now
        </span>
      </div>

      {/* Serif Heading */}
      <h3 className="font-headline-sm text-ink-text leading-tight">{decision.title}</h3>

      {/* Options List */}
      <div className="space-y-4">
        {decision.options.map((option) => {
          const optionVotes = decision.votes.filter((v) => v.option_id === option.id);
          const yesVotes = optionVotes.filter((v) => v.value === 'yes');
          const noVotes = optionVotes.filter((v) => v.value === 'no');

          // Check current user's vote for this option
          const currentUserVote = optionVotes.find((v) => v.member_id === currentMemberId);

          // Calculate percentage or segment display
          const confirmedCount = yesVotes.length;
          const pendingCount = totalMemberCount - optionVotes.length;

          // Check if consensus is reached (everyone confirmed)
          const hasConsensus = confirmedCount === totalMemberCount && totalMemberCount > 0;

          // Find who hasn't voted for this option
          const votedMemberIds = optionVotes.map((v) => v.member_id);
          const pendingMembers = activeMembers.filter((m) => !votedMemberIds.includes(m.id));

          return (
            <div key={option.id} className="border border-border-warm-grey rounded-xl p-4 bg-surface/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-body-md font-semibold text-ink-text">{option.label}</h4>
                  <p className="font-body-sm text-muted-text text-xs">
                    Proposed by {members.find((m) => m.id === option.proposed_by)?.name || 'Organizer'}
                  </p>
                </div>
                {hasConsensus && (
                  <span className="font-label-caps text-[9px] bg-primary-container text-surface px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                    <Check className="w-2.5 h-2.5" /> Consensus
                  </span>
                )}
              </div>

              {/* Segmented Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex gap-1 h-2 w-full bg-surface-dim/40 rounded-full overflow-hidden">
                  {Array.from({ length: totalMemberCount }).map((_, idx) => {
                    const isConfirmed = idx < confirmedCount;
                    const isRejected = idx >= confirmedCount && idx < confirmedCount + noVotes.length;
                    return (
                      <div
                        key={idx}
                        className={`flex-grow h-full rounded-sm transition-colors duration-300 ${
                          isConfirmed
                            ? 'bg-primary-container'
                            : isRejected
                            ? 'bg-secondary'
                            : 'bg-border-warm-grey/60'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[11px] font-body-sm text-muted-text">
                  <span>
                    {confirmedCount} confirmed {noVotes.length > 0 && `· ${noVotes.length} objected`}
                  </span>
                  <span>{pendingCount} pending</span>
                </div>
              </div>

              {/* Vote Buttons (Confirm / Object) */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex gap-2">
                  {/* Confirm Button */}
                  <button
                    type="button"
                    onClick={() => onVote(decision.id, option.id, 'yes')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-body-sm text-xs font-medium transition duration-150 ${
                      currentUserVote?.value === 'yes'
                        ? 'bg-primary-container text-surface border border-transparent shadow-sm'
                        : 'border border-border-warm-grey text-muted-text hover:text-ink-text hover:bg-surface-container'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Confirm
                  </button>

                  {/* Object Button */}
                  <button
                    type="button"
                    onClick={() => onVote(decision.id, option.id, 'no')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-body-sm text-xs font-medium transition duration-150 ${
                      currentUserVote?.value === 'no'
                        ? 'bg-secondary text-surface border border-transparent shadow-sm'
                        : 'border border-border-warm-grey text-muted-text hover:text-secondary hover:bg-surface-container'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    Object
                  </button>
                </div>

                {/* Lock Option button for consensus or organizer overrides */}
                {(hasConsensus || currentMemberId) && (
                  <button
                    type="button"
                    onClick={() => onLock(decision.id, option.id)}
                    className="font-label-caps text-[10px] text-primary-container hover:text-primary hover:underline transition duration-150 font-bold"
                  >
                    Lock Decision →
                  </button>
                )}
              </div>

              {/* Nudge list */}
              {pendingMembers.length > 0 && (
                <div className="text-[11px] font-body-sm text-secondary pt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {pendingMembers.map((m) => m.name).join(', ')} hasn&apos;t voted.{" "}
                    <button
                      type="button"
                      disabled={nudgedOptions[option.id]}
                      onClick={() => handleNudge(pendingMembers, option.label, option.id)}
                      className={`font-bold underline decoration-1 underline-offset-2 cursor-pointer text-secondary ${
                        nudgedOptions[option.id] ? 'no-underline opacity-50 cursor-default' : 'hover:no-underline'
                      }`}
                    >
                      {nudgedOptions[option.id] ? 'Nudged!' : 'Nudge →'}
                    </button>
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* BOOKABLE OFFERS INLINE (HOTELS) */}
        {hotelOffers.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-dashed border-border-warm-grey/65">
            <span className="block font-label-caps text-[9px] text-[#C2592F] font-bold">SPONSORED BOOKING OPTIONS</span>
            <div className="space-y-2">
              {hotelOffers.map((offer) => {
                const clickUrl = `/api/offer/${offer.id}/click?memberId=${currentMemberId || 'guest'}`;
                return (
                  <div key={offer.id} className="border border-secondary/35 rounded-xl p-3 bg-surface/5 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-label-caps text-[8px] bg-secondary/15 text-secondary px-1.5 py-0.2 rounded font-bold">
                        {offer.partner} choice
                      </span>
                      <h4 className="font-body-md font-semibold text-ink-text text-xs leading-snug mt-1">{offer.title}</h4>
                      <span className="font-mono text-xs font-bold text-[#1f4d3f] mt-0.5 block">
                        ₹{Number(offer.price).toLocaleString()}
                      </span>
                    </div>
                    <a
                      href={clickUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#1f4d3f] hover:bg-primary text-surface font-body-sm font-semibold text-[10px] py-1.5 px-3 rounded-lg shrink-0 flex items-center gap-1 shadow-xs transition"
                    >
                      Book <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
