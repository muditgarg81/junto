'use strict';

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Navigation, ArrowLeft, ArrowRight, UserPlus, FileText, Landmark, ChevronLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Trip, Member, Message } from '@/lib/types';
import { EmergencyShieldButton } from '@/components/EmergencyShieldButton';
import { hapticTap, hapticSuccess } from '@/lib/native';

interface ChatClientProps {
  trip: Trip;
  members: Member[];
  initialMessages: Message[];
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
}

export default function ChatClient({
  trip,
  members,
  initialMessages,
  currentMember,
}: ChatClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tripId = trip.id;
  const currentMemberId = currentMember?.memberId || null;

  // Auto-scroll to bottom on mount and new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime Polling Sync (every 3 seconds)
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trip/${tripId}/sync`);
        if (!res.ok) throw new Error('Sync failed');
        const data = await res.json();
        if (active && data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Error polling messages:', err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tripId]);

  // Handle post message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentMemberId || isSending) return;
    hapticTap();

    const bodyText = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistic Update
    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      trip_id: tripId,
      author_id: currentMemberId,
      is_ai: false,
      body: bodyText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch(`/api/trip/${tripId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentMemberId,
          body: bodyText,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');
      
      // Pull latest state immediately after sending
      const syncRes = await fetch(`/api/trip/${tripId}/sync`);
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        setMessages(syncData.messages);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle AI: Make it a proposal CTA
  const handleMakeProposal = async (msgId: string, draft: any) => {
    if (!currentMemberId) return;

    setActionStates((prev) => ({ ...prev, [msgId]: 'loading' }));
    try {
      const res = await fetch(`/api/trip/${tripId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          type: draft.type,
          title: draft.title,
          options: draft.options,
          proposedBy: currentMemberId,
        }),
      });

      if (!res.ok) throw new Error('Failed to create proposal');
      setActionStates((prev) => ({ ...prev, [msgId]: 'done' }));
    } catch (err) {
      console.error(err);
      alert('Failed to create proposal.');
      setActionStates((prev) => ({ ...prev, [msgId]: 'idle' }));
    }
  };

  // Handle AI: Log expense CTA
  const handleLogExpense = async (msgId: string, expenseDraft: any) => {
    if (!currentMemberId) return;

    setActionStates((prev) => ({ ...prev, [msgId]: 'loading' }));
    try {
      const res = await fetch(`/api/trip/${tripId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          expenseId: expenseDraft.expenseId,
        }),
      });

      if (!res.ok) throw new Error('Failed to confirm expense');
      setActionStates((prev) => ({ ...prev, [msgId]: 'done' }));
    } catch (err) {
      console.error(err);
      alert('Failed to confirm expense.');
      setActionStates((prev) => ({ ...prev, [msgId]: 'idle' }));
    }
  };

  // Handle AI: Undo checklist item auto-addition
  const handleUndoChecklistItem = async (msgId: string, item: any) => {
    if (!currentMemberId) return;

    setActionStates((prev) => ({ ...prev, [msgId]: 'loading' }));
    try {
      const res = await fetch(`/api/trip/${tripId}/checklist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });

      if (!res.ok) throw new Error('Failed to delete item');
      setActionStates((prev) => ({ ...prev, [msgId]: 'done' }));
    } catch (err) {
      console.error(err);
      alert('Failed to undo checklist item addition.');
      setActionStates((prev) => ({ ...prev, [msgId]: 'idle' }));
    }
  };

  // Compute roster tallies
  const goingCount = members.filter((m) => m.status === 'confirmed').length;
  const maybeCount = members.filter((m) => m.status === 'maybe').length;

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm overflow-hidden">
      {/* App Bar */}
      <div className="bg-card-cream border-b border-border-warm-grey px-6 pb-4 pt-safe flex items-center justify-between z-20 shadow-xs" style={{paddingTop: 'max(env(safe-area-inset-top, 0px), 0.5rem)'}}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/trip/${tripId}/plan`} className="text-ink-text hover:text-secondary transition shrink-0">
            <ArrowLeft className="w-5.5 h-5.5" />
          </Link>
          <div className="min-w-0 text-left">
            <h1 className="font-headline-sm text-ink-text leading-tight font-bold truncate max-w-[150px] md:max-w-[180px]" title={trip.name}>
              {trip.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Link 
                href="/chat" 
                className="text-[9px] text-secondary hover:underline font-bold font-label-caps bg-secondary/10 px-2 py-0.5 rounded shrink-0 transition"
              >
                Switch Chat
              </Link>
              <p className="font-body-sm text-[11px] text-muted-text shrink-0">
                {goingCount} going {maybeCount > 0 && `· ${maybeCount} maybe`}
              </p>
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
          <Link
            href={`/trip/${tripId}/invite`}
            className="text-muted-text hover:text-ink-text p-1.5 border border-border-warm-grey rounded-full"
            title="Group Roster"
          >
            <UserPlus className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Read-only Banner for guests who haven't joined yet */}
      {!currentMemberId && (
        <div className="bg-secondary/10 border-b border-secondary/20 px-6 py-3 flex items-center justify-between text-xs text-secondary font-medium z-10">
          <span className="flex items-center gap-1">
            Viewing chat as guest. Join to send messages.
          </span>
          <Link
            href={`/join/${trip.invite_token}`}
            className="font-bold underline hover:text-red-800 transition"
          >
            Join
          </Link>
        </div>
      )}

      {/* Chat History Container */}
      <div data-scroll className="flex-grow overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-50">
            <Sparkles className="w-8 h-8 text-primary-container" />
            <p className="font-body-sm text-muted-text">
              Trip chat started. Type a message or ask @ai to recommend something!
            </p>
          </div>
        ) : (
          messages.map((message) => {
            // Render system locks/AI announcements
            if (message.is_ai && message.body.startsWith('✓')) {
              return (
                <div key={message.id} className="flex justify-center my-2">
                  <span className="font-label-caps text-[10px] bg-primary-container/10 text-primary-container border border-primary-container/20 px-3 py-1 rounded-full flex items-center gap-1 shadow-xs">
                    {message.body}
                  </span>
                </div>
              );
            }

            // Render standard AI bubbles
            if (message.is_ai) {
              const meta = message.metadata ? (typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata) : null;
              const hasProposal = meta?.trigger === 'emerging_decision' && meta?.proposalDraft;
              const hasExpense = meta?.trigger === 'expense' && meta?.expenseDraft;
              const hasChecklistItem = meta?.trigger === 'checklist_assignment' && meta?.checklistItem;
              const state = actionStates[message.id] || 'idle';

              return (
                <div key={message.id} className="flex flex-col space-y-1 max-w-[90%] my-3">
                  <span className="font-label-caps text-[10px] text-[#1f4d3f] px-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Assistant
                  </span>
                  
                  {/* Sage-tinted AI Container */}
                  <div className="bg-ai-sage-tint border border-[#1f4d3f]/20 p-4 rounded-2xl shadow-sm text-ink-text font-body-sm space-y-3">
                    <p className="leading-relaxed">{message.body}</p>

                    {/* Proposal Action Card */}
                    {hasProposal && currentMemberId && (
                      <div className="bg-card-cream border border-border-warm-grey rounded-xl p-3.5 space-y-3">
                        <div className="text-[10px] font-label-caps text-secondary">
                          Draft Proposal
                        </div>
                        <div className="font-headline-sm text-sm text-ink-text">
                          {meta.proposalDraft.title}
                        </div>
                        {state === 'idle' ? (
                          <button
                            onClick={() => handleMakeProposal(message.id, meta.proposalDraft)}
                            className="w-full flex items-center justify-center gap-1.5 bg-primary-container hover:bg-primary text-surface font-body-sm font-semibold py-2 px-4 rounded-lg text-xs shadow-xs transition"
                          >
                            <Navigation className="w-3.5 h-3.5 rotate-45" />
                            Make it a proposal
                          </button>
                        ) : state === 'loading' ? (
                          <div className="text-center font-body-sm text-xs text-muted-text py-1.5">
                            Creating...
                          </div>
                        ) : (
                          <div className="text-center text-primary-container font-semibold font-body-sm text-xs py-1.5 flex items-center justify-center gap-1">
                            ✓ Proposal Added to Plan!
                          </div>
                        )}
                      </div>
                    )}

                    {/* Checklist Assignment Action Card */}
                    {hasChecklistItem && currentMemberId && (
                      <div className="bg-card-cream border border-border-warm-grey rounded-xl p-3.5 space-y-3">
                        <div className="text-[10px] font-label-caps text-primary flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-primary" />
                          Checklist Item Added
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-body-md font-semibold text-ink-text text-xs line-clamp-2">
                            {meta.checklistItem.label}
                          </span>
                          <span className="text-[9px] text-muted-text font-body-sm shrink-0 bg-surface-container border border-border-warm-grey px-1.5 py-0.5 rounded-md">
                            {meta.checklistItem.category === 'shared' ? 'Shared Gear' : 'Personal'}
                          </span>
                        </div>
                        <div className="text-[10px] font-body-sm text-muted-text">
                          Assigned to: <span className="font-semibold text-ink-text">{meta.checklistItem.assigneeName === 'unassigned' ? 'Unassigned' : meta.checklistItem.assigneeName}</span>
                        </div>

                        {state === 'idle' ? (
                          <button
                            onClick={() => handleUndoChecklistItem(message.id, meta.checklistItem)}
                            className="w-full flex items-center justify-center gap-1 border border-border-warm-grey hover:bg-surface-container text-secondary font-body-sm font-semibold py-1.5 px-3 rounded-lg text-[11px] shadow-xs transition"
                          >
                            Undo addition
                          </button>
                        ) : state === 'loading' ? (
                          <div className="text-center font-body-sm text-xs text-muted-text py-1.5">
                            Undoing...
                          </div>
                        ) : (
                          <div className="text-center text-[#ba1a1a] font-semibold font-body-sm text-xs py-1.5 flex items-center justify-center gap-1">
                            ✓ Undone/Removed!
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expense Action Card */}
                    {hasExpense && currentMemberId && (
                      <div className="bg-card-cream border border-border-warm-grey rounded-xl p-3.5 space-y-3">
                        <div className="text-[10px] font-label-caps text-[#B98A3C] flex items-center gap-1">
                          <Landmark className="w-3 h-3" />
                          Draft Expense Log
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-body-md font-semibold text-ink-text">
                            {meta.expenseDraft.description}
                          </span>
                          <span className="font-mono-price text-sm text-secondary">
                            {meta.expenseDraft.currency} {meta.expenseDraft.amount}
                          </span>
                        </div>
                        <div className="text-[11px] font-body-sm text-muted-text">
                          Paid by {members.find(m => m.id === meta.expenseDraft.paidBy)?.name || 'you'} · Split {meta.expenseDraft.splitWith.length} ways
                        </div>

                        {state === 'idle' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleLogExpense(message.id, meta.expenseDraft)}
                              className="flex-1 bg-primary-container hover:bg-primary text-surface font-body-sm font-semibold py-2 px-3 rounded-lg text-xs shadow-xs transition"
                            >
                              Log expense
                            </button>
                            <Link
                              href={`/trip/${tripId}/money`}
                              className="flex-1 border border-border-warm-grey text-muted-text hover:text-ink-text py-2 px-3 rounded-lg text-xs text-center font-body-sm font-medium hover:bg-surface-container"
                            >
                              Edit
                            </Link>
                          </div>
                        ) : state === 'loading' ? (
                          <div className="text-center font-body-sm text-xs text-muted-text py-1.5">
                            Logging...
                          </div>
                        ) : (
                          <div className="text-center text-primary-container font-semibold font-body-sm text-xs py-1.5 flex items-center justify-center gap-1">
                            ✓ Expense Logged!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Render Human message bubble
            const isMe = message.author_id === currentMemberId;
            const author = members.find((m) => m.id === message.author_id);
            const authorName = isMe ? 'You' : author?.name || 'Friend';

            return (
              <div
                key={message.id}
                className={`flex flex-col space-y-0.5 max-w-[80%] ${
                  isMe ? 'ml-auto items-end text-right' : 'mr-auto items-start text-left'
                }`}
              >
                {!isMe && (
                  <span className="font-label-caps text-[9px] text-muted-text px-1">
                    {authorName}
                  </span>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm font-body-md shadow-xs leading-relaxed ${
                    isMe
                      ? 'bg-primary-container text-surface-container-lowest rounded-tr-xs'
                      : 'bg-card-cream text-ink-text border border-border-warm-grey rounded-tl-xs'
                  }`}
                >
                  {message.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input bar */}
      {currentMemberId && (
        <form
          onSubmit={handleSendMessage}
          className="bg-card-cream border-t border-border-warm-grey px-4 py-3 flex gap-2 items-center z-20 shadow-md max-w-md mx-auto w-full"
        >
          <input
            type="text"
            placeholder="Type a message or ask @ai..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending}
            className="flex-grow bg-surface border border-border-warm-grey rounded-full px-4 py-2.5 text-sm font-body-md text-ink-text outline-none focus:border-outline transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="bg-primary-container hover:bg-primary text-surface p-2.5 rounded-full shadow-sm disabled:bg-outline-variant transition duration-200 active:scale-90"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
      )}

      {/* Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="chat" />
    </div>
  );
}
