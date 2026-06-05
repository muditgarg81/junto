'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Sparkles, Navigation, Plus, Trash2, Landmark, Check, AlertCircle, Edit2, BarChart2, ArrowRight, Home } from 'lucide-react';
import Link from 'next/link';
import AddExpenseModal from './AddExpenseModal';
import BottomNav from '@/components/BottomNav';
import { calculateSettleUp, Transfer } from '@/lib/settle';
import { Trip, Member, Expense, Split } from '@/lib/types';
import { EmergencyShieldButton } from '@/components/EmergencyShieldButton';

interface MoneyClientProps {
  trip: Trip;
  members: Member[];
  initialExpenses: (Expense & { splits: Split[] })[];
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
  datesPayload?: any;
  budgetDecision?: any;
}

export default function MoneyClient({
  trip,
  members,
  initialExpenses,
  currentMember,
  datesPayload,
  budgetDecision,
}: MoneyClientProps) {
  const [expenseList, setExpenseList] = useState(initialExpenses);
  const [memberList, setMemberList] = useState(members);
  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'summary'>('expenses');

  const [showAddModal, setShowAddModal] = useState(false);
  const [activeDraft, setActiveDraft] = useState<any | null>(null);

  // States for updating UPI ID inline
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [upiInput, setUpiInput] = useState('');

  const tripId = trip.id;
  const currentMemberId = currentMember?.memberId || null;

  // Realtime Polling Sync (every 3 seconds)
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trip/${tripId}/sync`);
        if (!res.ok) throw new Error('Sync failed');
        const data = await res.json();
        if (active) {
          if (data.expenses) setExpenseList(data.expenses);
          if (data.members) setMemberList(data.members);
        }
      } catch (err) {
        console.error('Error polling expenses:', err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tripId]);

  // Sync data refresh callback
  const refreshData = async () => {
    try {
      const res = await fetch(`/api/trip/${tripId}/sync`);
      if (res.ok) {
        const data = await res.json();
        if (data.expenses) setExpenseList(data.expenses);
        if (data.members) setMemberList(data.members);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Log draft expense from top cards
  const handleConfirmDraft = async (expenseId: string) => {
    try {
      const res = await fetch(`/api/trip/${tripId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          expenseId,
        }),
      });

      if (!res.ok) throw new Error('Failed to confirm expense');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to log expense.');
    }
  };

  // Edit draft expense
  const handleEditDraft = (draftExpense: Expense & { splits: Split[] }) => {
    setActiveDraft({
      expenseId: draftExpense.id,
      amount: Number(draftExpense.amount),
      description: draftExpense.description,
      paidBy: draftExpense.paid_by,
      splitWith: draftExpense.splits.map((s) => s.member_id),
    });
    setShowAddModal(true);
  };

  // Delete manual expense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const res = await fetch(`/api/trip/${tripId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          expenseId,
        }),
      });

      if (!res.ok) throw new Error('Failed to delete expense');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete expense.');
    }
  };

  // Update member UPI ID
  const handleSaveUpi = async (memberId: string) => {
    try {
      const res = await fetch(`/api/trip/${tripId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_upi',
          memberId,
          upiId: upiInput.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to update UPI ID');
      setEditingMemberId(null);
      setUpiInput('');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to update UPI ID.');
    }
  };

  // Manual Settle entries:
  // If A settles with B for ₹1,600, B (creditor) is paid by A (debtor).
  // We insert a manual expense paid by A, split 100% to B.
  const handleManualSettle = async (transfer: Transfer) => {
    if (
      !confirm(
        `Mark settled? This logs a transaction where ${transfer.fromName} paid ${transfer.toName} ₹${transfer.amount} to balance the ledger.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/trip/${tripId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          amount: transfer.amount,
          description: `Settle-up: ${transfer.fromName} to ${transfer.toName}`,
          category: 'Other',
          paidBy: transfer.fromMemberId, // paid by debtor
          splitType: 'exact',
          splits: [
            {
              memberId: transfer.toMemberId, // split entirely to creditor
              exactAmount: transfer.amount,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Failed to log settlement');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to log settlement.');
    }
  };

  // Math Tallies
  const manualExpenses = expenseList.filter((e) => e.source === 'manual');
  const draftExpenses = expenseList.filter((e) => e.source === 'ai-draft');

  const totalSpent = manualExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const activeMembersCount = memberList.filter(
    (m) => m.status === 'confirmed' || m.status === 'maybe'
  ).length;

  // Net Balance Tally (Paid - Owed)
  const balances: Record<string, number> = {};
  memberList.forEach((m) => {
    balances[m.id] = 0;
  });

  manualExpenses.forEach((exp) => {
    const amount = Number(exp.amount);
    const paidBy = exp.paid_by;

    if (balances[paidBy] !== undefined) {
      balances[paidBy] += amount;
    }

    const expSplits = exp.splits;
    if (expSplits.length === 0) return;

    if (exp.split_type === 'equal') {
      const share = amount / expSplits.length;
      expSplits.forEach((s) => {
        if (balances[s.member_id] !== undefined) {
          balances[s.member_id] -= share;
        }
      });
    } else if (exp.split_type === 'shares') {
      const totalShares = expSplits.reduce((acc, s) => acc + Number(s.weight || 1), 0);
      if (totalShares > 0) {
        expSplits.forEach((s) => {
          const share = (amount * Number(s.weight || 1)) / totalShares;
          if (balances[s.member_id] !== undefined) {
            balances[s.member_id] -= share;
          }
        });
      }
    } else if (exp.split_type === 'exact') {
      expSplits.forEach((s) => {
        const exact = Number(s.exact_amount || 0);
        if (balances[s.member_id] !== undefined) {
          balances[s.member_id] -= exact;
        }
      });
    }
  });

  // Settle-up transfers calculation
  const transfers = calculateSettleUp(memberList, expenseList);

  // Helper to format trip dates for summary subtitle
  const getDatesString = () => {
    if (datesPayload) {
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
        
        if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
          return `${formatMonthDay(start)}–${end.getDate()}`;
        } else {
          return `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
        }
      }
    }
    return 'Dates TBD';
  };

  const confirmedCount = memberList.filter(m => m.status === 'confirmed').length;
  const subtitleString = `${trip.name} · ${getDatesString()} · ${confirmedCount} ${confirmedCount === 1 ? 'person' : 'people'}`;

  const perPersonSpent = activeMembersCount > 0 ? (totalSpent / activeMembersCount) : 0;
  const myBalance = currentMemberId ? (balances[currentMemberId] || 0) : 0;

  // Budget calculations
  let budgetMin = 18000;
  let budgetMax = 22000;
  let budgetLabel = "₹18k – ₹22k per person";

  if (budgetDecision) {
    budgetLabel = budgetDecision.label;
    let payload = budgetDecision.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {}
    }
    if (payload) {
      budgetMin = Number(payload.rangeStart || payload.amount || 18000);
      budgetMax = Number(payload.rangeEnd || payload.amount || 22000);
    }
  }
  const budgetTarget = (budgetMin + budgetMax) / 2;
  const percentageOfBudget = budgetTarget > 0 ? Math.min(100, Math.round((perPersonSpent / budgetTarget) * 100)) : 0;
  const isUnderBudget = perPersonSpent <= budgetTarget;

  // Category breakdown calculations
  const categorySums: Record<string, number> = { Stay: 0, Transport: 0, Food: 0, Activities: 0, Other: 0 };
  manualExpenses.forEach(exp => {
    const cat = exp.category;
    const amt = Number(exp.amount);
    
    if (cat === 'Stay' || cat === 'Accommodation' || cat === 'Hotel' || cat === 'Lodging') {
      categorySums.Stay += amt;
    } else if (cat === 'Transport' || cat === 'Flights' || cat === 'Travel' || cat === 'Cab' || cat === 'Train') {
      categorySums.Transport += amt;
    } else if (cat === 'Food' || cat === 'Drinks' || cat === 'Dining') {
      categorySums.Food += amt;
    } else if (cat === 'Activities' || cat === 'Sightseeing' || cat === 'Entertainment') {
      categorySums.Activities += amt;
    } else {
      categorySums.Other += amt;
    }
  });

  const categoryBreakdown = Object.entries(categorySums).map(([cat, sum]) => {
    const pct = totalSpent > 0 ? Math.round((sum / totalSpent) * 100) : 0;
    return {
      category: cat,
      amount: sum,
      percentage: pct
    };
  }).sort((a, b) => b.amount - a.amount);

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      {/* Main Container */}
      <div className="flex-grow px-6 py-6 space-y-6 z-10 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-surface/95 backdrop-blur-xs border-b border-border-warm-grey/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">
                  {activeSubTab === 'summary' ? 'Trip costs' : 'Money'}
                </h1>
                <span className="font-body-sm text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold shrink-0">
                  {trip.name}
                </span>
              </div>
              <p className="font-body-sm text-muted-text">
                {activeSubTab === 'summary' 
                  ? subtitleString 
                  : `₹${totalSpent.toLocaleString('en-IN')} spent · ${activeMembersCount} people`
                }
              </p>
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
                onClick={() => {
                  setActiveDraft(null);
                  setShowAddModal(true);
                }}
                className="bg-primary-container hover:bg-primary text-surface p-2.5 rounded-full shadow-sm hover:scale-105 transition-transform"
                title="Log Expense"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-tab segmented toggle */}
        <div className="flex bg-surface-container-high/40 p-1 rounded-xl border border-border-warm-grey/60 max-w-[200px] text-left">
          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`flex-grow py-1 px-3 rounded-lg text-[11px] font-semibold tracking-wide transition duration-150 text-center ${
              activeSubTab === 'expenses'
                ? 'bg-card-cream text-ink-text shadow-xs'
                : 'text-muted-text hover:text-ink-text'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveSubTab('summary')}
            className={`flex-grow py-1 px-3 rounded-lg text-[11px] font-semibold tracking-wide transition duration-150 text-center ${
              activeSubTab === 'summary'
                ? 'bg-card-cream text-ink-text shadow-xs'
                : 'text-muted-text hover:text-ink-text'
            }`}
          >
            Summary
          </button>
        </div>

        {activeSubTab === 'expenses' ? (
          <>
            {/* 1. AI DRAFTS SECTION */}
            {draftExpenses.length > 0 && (
              <div className="space-y-2">
                {draftExpenses.map((draft) => (
                  <div
                    key={draft.id}
                    className="bg-ai-sage-tint border border-[#1f4d3f]/20 p-4 rounded-2xl shadow-sm text-left space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps text-[10px] text-[#1f4d3f] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#1f4d3f]" />
                        AI DRAFT EXPENSE
                      </span>
                      <span className="font-body-sm text-[11px] text-muted-text">From chat</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-body-md font-semibold text-ink-text">
                        {draft.description}
                      </span>
                      <span className="font-mono-price text-base text-secondary">
                        ₹{Number(draft.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-[11px] font-body-sm text-muted-text">
                      Paid by{' '}
                      {memberList.find((m) => m.id === draft.paid_by)?.name || 'Someone'} · Split{' '}
                      {draft.splits.length} ways
                    </div>

                    {currentMemberId && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmDraft(draft.id)}
                          className="flex-1 bg-primary-container hover:bg-primary text-surface font-body-sm font-semibold py-2 px-3 rounded-lg text-xs shadow-xs transition"
                        >
                          Log expense
                        </button>
                        <button
                          onClick={() => handleEditDraft(draft)}
                          className="flex-1 border border-[#1f4d3f]/20 text-muted-text hover:text-ink-text py-2 px-3 rounded-lg text-xs font-body-sm font-medium hover:bg-white/40 transition"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 2. SETTLE UP INTENTS */}
            {transfers.length > 0 && (
              <div className="bg-primary-container text-surface-container-lowest p-5 rounded-2xl shadow-md space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="font-label-caps text-xs text-on-primary-container tracking-wider flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" />
                    SETTLE UP · {transfers.length} {transfers.length === 1 ? 'TRANSFER' : 'TRANSFERS'}
                  </h2>
                </div>
                <div className="space-y-3">
                  {transfers.map((t, idx) => {
                    const upiLink = t.toUpiId
                      ? `upi://pay?pa=${t.toUpiId}&pn=${encodeURIComponent(
                          t.toName
                        )}&am=${t.amount}&cu=INR`
                      : null;

                    return (
                      <div key={idx} className="flex items-center justify-between gap-3 text-sm border-b border-white/10 pb-2.5 last:border-b-0 last:pb-0">
                        <div>
                          <span className="font-body-md font-semibold text-white">{t.fromName}</span>
                          <span className="text-white/60 text-xs font-body-sm mx-1.5">owes</span>
                          <span className="font-body-md font-semibold text-white">{t.toName}</span>
                          <div className="font-mono-price text-sm text-[#8dbdab] mt-0.5">
                            ₹{t.amount.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {upiLink ? (
                            <a
                              href={upiLink}
                              className="bg-card-cream text-primary-container hover:bg-white font-body-sm text-[11px] font-bold py-1.5 px-3 rounded-lg shadow-sm transition"
                            >
                              Pay · UPI
                            </a>
                          ) : (
                            <button
                              onClick={() => {
                                if (t.toMemberId === currentMemberId) {
                                  setEditingMemberId(t.toMemberId);
                                  setUpiInput('');
                                } else {
                                  alert(`${t.toName} hasn't registered a UPI ID yet. They need to configure it in their Balances panel.`);
                                }
                              }}
                              className="bg-[#B98A3C] text-white font-body-sm text-[10px] font-bold py-1.5 px-2.5 rounded-lg shadow-sm"
                            >
                              {t.toMemberId === currentMemberId ? 'Add your UPI' : 'No UPI VPA'}
                            </button>
                          )}
                          {currentMemberId && (
                            <button
                              onClick={() => handleManualSettle(t)}
                              className="border border-white/20 text-white/90 hover:bg-white/10 font-body-sm text-[10px] py-1.5 px-2.5 rounded-lg transition"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. BALANCES */}
            <div className="space-y-3">
              <h2 className="font-label-caps text-xs text-muted-text tracking-wider text-left">BALANCES</h2>
              <div className="bg-card-cream border border-border-warm-grey rounded-2xl divide-y divide-border-warm-grey overflow-hidden shadow-sm">
                {memberList
                  .filter((m) => m.status === 'confirmed' || m.status === 'maybe')
                  .map((member) => {
                    const bal = balances[member.id] || 0;
                    const roundedBal = Math.round(bal * 100) / 100;
                    const isPositive = roundedBal > 0.01;
                    const isNegative = roundedBal < -0.01;

                    const textClass = isPositive
                      ? 'text-[#1f4d3f]'
                      : isNegative
                      ? 'text-[#a04018]'
                      : 'text-muted-text';
                    const prefix = isPositive ? '+' : '';

                    const isEditingUpi = editingMemberId === member.id;

                    return (
                      <div key={member.id} className="p-4 flex flex-col space-y-2 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface border border-border-warm-grey flex items-center justify-center font-headline-sm text-xs text-ink-text shrink-0">
                              {(member.name || 'Guest').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-body-md font-medium text-ink-text">
                                {member.name || 'Guest'}
                              </span>
                              <span className="block text-[10px] text-muted-text font-body-sm select-all">
                                {member.upi_id ? member.upi_id : 'No UPI registered'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`font-mono-price text-sm font-bold ${textClass}`}>
                              {prefix}₹{roundedBal.toLocaleString('en-IN')}
                            </span>
                            {currentMemberId === member.id && !isEditingUpi && (
                              <button
                                onClick={() => {
                                  setEditingMemberId(member.id);
                                  setUpiInput(member.upi_id || '');
                                }}
                                className="text-muted-text hover:text-ink-text p-1.5 hover:bg-surface-container rounded-lg transition"
                                title="Edit UPI ID"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline edit UPI input */}
                        {isEditingUpi && (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="e.g. name@upi"
                              value={upiInput}
                              onChange={(e) => setUpiInput(e.target.value)}
                              className="flex-grow bg-surface border border-border-warm-grey rounded-lg px-3 py-1.5 text-xs font-mono-price outline-none"
                            />
                            <button
                              onClick={() => handleSaveUpi(member.id)}
                              className="bg-primary-container text-surface hover:bg-primary px-3 py-1.5 rounded-lg text-xs font-bold font-body-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMemberId(null)}
                              className="border border-border-warm-grey hover:bg-surface-container text-muted-text px-3 py-1.5 rounded-lg text-xs font-medium font-body-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 4. RECENT EXPENSES */}
            <div className="space-y-3">
              <h2 className="font-label-caps text-xs text-muted-text tracking-wider text-left">RECENT EXPENSES</h2>
              {manualExpenses.length === 0 ? (
                <div className="bg-card-cream/60 border border-dashed border-border-warm-grey rounded-2xl p-6 text-center text-muted-text font-body-sm">
                  No transactions recorded. Tap the + icon to log an expense!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {manualExpenses.map((exp) => {
                    const payer = memberList.find((m) => m.id === exp.paid_by);

                    const categoryColors: Record<string, string> = {
                      Food: 'bg-orange-100 text-orange-800',
                      Transport: 'bg-blue-100 text-blue-800',
                      Stay: 'bg-teal-100 text-teal-800',
                      Activities: 'bg-purple-100 text-purple-800',
                      Other: 'bg-gray-100 text-gray-800',
                    };
                    const catBadge = categoryColors[exp.category] || categoryColors.Other;

                    return (
                      <div
                        key={exp.id}
                        className="bg-card-cream border border-border-warm-grey p-4 rounded-xl shadow-xs flex items-center justify-between text-left gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-body-md font-semibold text-ink-text truncate">
                              {exp.description}
                            </span>
                            <span className={`text-[9px] font-bold font-label-caps px-1.5 py-0.5 rounded-md ${catBadge}`}>
                              {exp.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-text font-body-sm mt-0.5">
                            Paid by {payer?.name || 'Guest'} · split{' '}
                            {exp.split_type === 'equal'
                              ? 'Equally'
                              : exp.split_type === 'shares'
                              ? 'by Shares'
                              : 'Exactly'}{' '}
                            among {exp.splits.length} {exp.splits.length === 1 ? 'person' : 'people'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono-price text-sm text-ink-text font-bold">
                            ₹{Number(exp.amount).toLocaleString('en-IN')}
                          </span>
                          {currentMemberId && (
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-muted-text hover:text-secondary p-1 hover:bg-surface-container rounded-lg transition"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Hero stats band */}
            <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-4 grid grid-cols-3 divide-x divide-border-warm-grey/50 text-center shadow-xs">
              <div className="space-y-1">
                <span className="block font-label-caps text-[9px] text-muted-text uppercase">Total</span>
                <span className="block font-serif text-lg text-ink-text font-bold">₹{totalSpent.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-1 pl-2">
                <span className="block font-label-caps text-[9px] text-muted-text uppercase">Per Person</span>
                <span className="block font-serif text-lg text-ink-text font-bold">₹{Math.round(perPersonSpent).toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-1 pl-2">
                <span className="block font-label-caps text-[9px] text-muted-text font-bold uppercase">Your Balance</span>
                <span className={`block font-serif text-lg font-bold ${
                  myBalance > 0.01 ? 'text-[#1f4d3f]' : myBalance < -0.01 ? 'text-[#a04018]' : 'text-muted-text'
                }`}>
                  {myBalance > 0.01 ? '+' : ''}₹{Math.round(myBalance).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* BUDGET Card */}
            <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl text-left space-y-3 shadow-sm">
              <div className="flex justify-between items-baseline">
                <h3 className="font-label-caps text-[10px] text-muted-text font-bold uppercase tracking-wider">BUDGET</h3>
                <span className="font-body-md font-semibold text-ink-text text-xs">{budgetLabel}</span>
              </div>
              
              <div className="space-y-1.5">
                {/* Custom Progress bar */}
                <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden border border-border-warm-grey/50">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${isUnderBudget ? 'bg-[#1f4d3f]' : 'bg-[#a04018]'}`}
                    style={{ width: `${percentageOfBudget}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-medium">
                  <span className={`${isUnderBudget ? 'text-[#1f4d3f]' : 'text-[#a04018]'}`}>
                    ₹{Math.round(perPersonSpent).toLocaleString('en-IN')} of ₹{budgetTarget.toLocaleString('en-IN')} used
                  </span>
                  <span className="text-muted-text italic">
                    {isUnderBudget ? 'comfortably under' : 'over budget target'}
                  </span>
                </div>
              </div>
            </div>

            {/* WHERE IT'S GOING Section */}
            <div className="space-y-3.5 text-left">
              <h2 className="font-label-caps text-xs text-muted-text tracking-wider px-1">WHERE IT&apos;S GOING</h2>
              <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-5 space-y-4 shadow-sm">
                {categoryBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs font-semibold text-ink-text">
                      <span className="font-body-md text-sm">{item.category}</span>
                      <span className="font-mono-price">{item.percentage}% · ₹{Math.round(item.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#1f4d3f]/75 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PER PERSON Section */}
            <div className="space-y-3.5 text-left">
              <h2 className="font-label-caps text-xs text-muted-text tracking-wider px-1">PER PERSON</h2>
              <div className="bg-card-cream border border-border-warm-grey rounded-2xl divide-y divide-border-warm-grey/50 overflow-hidden shadow-sm">
                {memberList
                  .filter(m => m.status === 'confirmed' || m.status === 'maybe')
                  .map((member) => {
                    const mPaid = expenseList.filter(e => e.source === 'manual' && e.paid_by === member.id).reduce((sum, e) => sum + Number(e.amount), 0);
                    const mBal = balances[member.id] || 0;
                    const mShare = mPaid - mBal;
                    
                    return (
                      <div key={member.id} className="p-4 flex items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surface border border-border-warm-grey flex items-center justify-center font-headline-sm text-xs text-ink-text">
                            {(member.name || 'Guest').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-body-md font-semibold text-ink-text block">
                              {member.name || 'Guest'}
                            </span>
                            <span className="block text-[10px] text-muted-text font-body-sm mt-0.5">
                              paid ₹{Math.round(mPaid).toLocaleString('en-IN')} · share ₹{Math.round(mShare).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Settle up footer card */}
            {transfers.length > 0 && (
              <button
                onClick={() => setActiveSubTab('expenses')}
                className="w-full flex items-center justify-between bg-card-cream border border-border-warm-grey hover:border-outline-variant p-4 rounded-xl shadow-sm text-[#1f4d3f] font-body-sm font-semibold hover:bg-surface-container-low transition text-left"
              >
                <span>Settle up · {transfers.length} {transfers.length === 1 ? 'transfer' : 'transfers'} →</span>
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            )}

          </div>
        )}
      </div>

      {/* ADD EXPENSE MODAL */}
      {showAddModal && (
        <AddExpenseModal
          tripId={tripId}
          members={memberList}
          currentMemberId={currentMemberId}
          onClose={() => {
            setShowAddModal(false);
            setActiveDraft(null);
          }}
          onSave={refreshData}
          draftData={activeDraft}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav tripId={tripId} activeTab="money" />
    </div>
  );
}
