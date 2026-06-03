'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, ArrowLeft, Coins, Landmark, Sparkles } from 'lucide-react';
import { Member } from '@/lib/types';

interface AddExpenseModalProps {
  tripId: string;
  members: Member[];
  currentMemberId: string | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  draftData?: {
    expenseId?: string;
    amount?: number;
    description?: string;
    paidBy?: string;
    splitWith?: string[]; // IDs
  } | null;
}

export default function AddExpenseModal({
  tripId,
  members,
  currentMemberId,
  onClose,
  onSave,
  draftData,
}: AddExpenseModalProps) {
  const activeMembers = members.filter((m) => m.status === 'confirmed' || m.status === 'maybe');

  // Input states
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Transport');
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<'equal' | 'shares' | 'exact'>('equal');

  // Checked members and custom split values
  const [checkedMembers, setCheckedMembers] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);

  // Prefill default or draft data
  useEffect(() => {
    // Default checked state is true for all active members
    const initialChecked: Record<string, boolean> = {};
    const initialWeights: Record<string, string> = {};
    const initialExacts: Record<string, string> = {};

    activeMembers.forEach((m) => {
      initialChecked[m.id] = true;
      initialWeights[m.id] = '1';
      initialExacts[m.id] = '';
    });

    if (draftData) {
      if (draftData.amount) setAmount(String(draftData.amount));
      if (draftData.description) setDescription(draftData.description);
      if (draftData.paidBy) setPaidBy(draftData.paidBy);
      
      if (draftData.splitWith && Array.isArray(draftData.splitWith)) {
        // If splitWith is provided, only check members inside it
        activeMembers.forEach((m) => {
          initialChecked[m.id] = draftData.splitWith!.includes(m.id);
        });
      }
    } else {
      // Default payer is current logged-in member
      setPaidBy(currentMemberId || (activeMembers[0]?.id || ''));
    }

    setCheckedMembers(initialChecked);
    setWeights(initialWeights);
    setExactAmounts(initialExacts);
  }, [draftData, currentMemberId, members]);

  // Categories list
  const categories = ['Transport', 'Food', 'Stay', 'Activity', 'Other'];

  // Calculations
  const numericAmount = parseFloat(amount) || 0;
  const checkedList = Object.keys(checkedMembers).filter((id) => checkedMembers[id]);
  const checkedCount = checkedList.length;

  // 1. Equal Split share
  const equalShare = checkedCount > 0 ? numericAmount / checkedCount : 0;

  // 2. Shares Split share calculation
  const getSharesTotalWeight = () => {
    return checkedList.reduce((acc, id) => acc + (parseFloat(weights[id]) || 0), 0);
  };
  const totalWeight = getSharesTotalWeight();

  // 3. Exact Split validation
  const getExactTotal = () => {
    return checkedList.reduce((acc, id) => acc + (parseFloat(exactAmounts[id]) || 0), 0);
  };
  const exactTotal = getExactTotal();
  const isExactSumValid = Math.abs(exactTotal - numericAmount) < 0.02;

  const handleToggleChecked = (memberId: string) => {
    setCheckedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const handleWeightChange = (memberId: string, val: string) => {
    // Only numeric or empty
    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
      setWeights((prev) => ({ ...prev, [memberId]: val }));
    }
  };

  const handleExactChange = (memberId: string, val: string) => {
    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
      setExactAmounts((prev) => ({ ...prev, [memberId]: val }));
    }
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numericAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description.');
      return;
    }
    if (checkedCount === 0) {
      alert('Please select at least one person to split with.');
      return;
    }

    if (splitType === 'shares' && totalWeight <= 0) {
      alert('Total shares must be greater than zero.');
      return;
    }

    if (splitType === 'exact' && !isExactSumValid) {
      alert(`The sum of split amounts (₹${exactTotal}) must equal the total expense amount (₹${numericAmount}). Current difference: ₹${Math.abs(numericAmount - exactTotal).toFixed(2)}`);
      return;
    }

    setIsSaving(true);

    try {
      const splitsPayload = checkedList.map((mId) => {
        const split: any = { memberId: mId };
        if (splitType === 'shares') {
          split.weight = parseFloat(weights[mId]) || 1;
        } else if (splitType === 'exact') {
          split.exactAmount = parseFloat(exactAmounts[mId]) || 0;
        }
        return split;
      });

      // If we confirm an existing AI draft, we can delete the draft or update it.
      // But since we have a confirmed action in the backend, if it's draftData, we first DELETE the draft and insert the new manual one,
      // OR we just write a clean new manual expense! Let's delete the draft first if it has draftData.expenseId.
      if (draftData?.expenseId) {
        await fetch(`/api/trip/${tripId}/expense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            expenseId: draftData.expenseId,
          }),
        });
      }

      // Save the manual expense
      const res = await fetch(`/api/trip/${tripId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          amount: numericAmount,
          description: description.trim(),
          category,
          paidBy,
          splitType,
          splits: splitsPayload,
        }),
      });

      if (!res.ok) throw new Error('Failed to save expense');

      await onSave();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while saving the expense.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-text/30 backdrop-blur-xs z-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-surface max-w-sm w-full rounded-3xl border border-border-warm-grey shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* App Bar */}
        <div className="bg-card-cream px-5 py-4 border-b border-border-warm-grey flex items-center justify-between shrink-0">
          <button onClick={onClose} className="text-muted-text hover:text-ink-text p-1">
            <ArrowLeft className="w-5.5 h-5.5" />
          </button>
          <span className="font-headline-sm text-base text-ink-text">Add expense</span>
          <button
            onClick={handleSave}
            disabled={isSaving || (splitType === 'exact' && !isExactSumValid)}
            className="font-label-caps text-xs text-primary-container disabled:text-outline-variant font-bold hover:underline"
          >
            Save
          </button>
        </div>

        {/* Form Body Scroll area */}
        <div className="flex-grow overflow-y-auto p-5 space-y-4 text-left scrollbar-thin">
          {/* Amount input card */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl shadow-sm text-center">
            <span className="block font-label-caps text-muted-text text-[10px] mb-1">
              Amount
            </span>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-display text-4xl text-secondary select-none">₹</span>
              <input
                type="text"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  if (e.target.value === '' || /^[0-9]*\.?[0-9]*$/.test(e.target.value)) {
                    setAmount(e.target.value);
                  }
                }}
                required
                className="bg-transparent text-ink-text font-display text-4xl outline-none w-48 text-center"
              />
            </div>
            {draftData && (
              <span className="text-[10px] font-body-sm text-primary-container bg-ai-sage-tint border border-[#1f4d3f]/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-3">
                <Sparkles className="w-2.5 h-2.5" /> Prefilled from Chat
              </span>
            )}
          </div>

          {/* Description & Category */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl shadow-sm space-y-4">
            <div className="space-y-1">
              <label htmlFor="description" className="block font-label-caps text-muted-text text-[10px]">
                Description
              </label>
              <input
                type="text"
                id="description"
                placeholder="e.g. Cab to hotel"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full bg-transparent text-ink-text font-body-md border-b border-border-warm-grey focus:border-outline outline-none py-1 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-label-caps text-muted-text text-[10px]">Category</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`font-body-sm text-xs px-3 py-1.5 rounded-full border transition duration-200 ${
                      category === cat
                        ? 'bg-primary-container text-surface border-transparent shadow-xs'
                        : 'border-border-warm-grey text-muted-text hover:text-ink-text hover:bg-surface-container'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Paid By dropdown */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl shadow-sm space-y-2">
            <label htmlFor="paidBy" className="block font-label-caps text-muted-text text-[10px]">
              Paid by
            </label>
            <select
              id="paidBy"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-transparent text-ink-text font-body-md outline-none py-1 border-b border-border-warm-grey focus:border-outline transition"
            >
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Splits controls */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-warm-grey pb-2">
              <label className="block font-label-caps text-muted-text text-[10px]">Split Mode</label>
              <div className="flex gap-1.5 bg-surface rounded-lg p-0.5 border border-border-warm-grey">
                {(['equal', 'shares', 'exact'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`font-label-caps text-[9px] px-2.5 py-1 rounded-md transition duration-200 ${
                      splitType === type
                        ? 'bg-primary-container text-surface shadow-xs font-semibold'
                        : 'text-muted-text hover:text-ink-text'
                    }`}
                  >
                    {type === 'equal' ? 'Equally' : type === 'shares' ? 'Shares' : 'Exact'}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Members list */}
            <div className="space-y-3">
              {activeMembers.map((member) => {
                const isChecked = !!checkedMembers[member.id];
                return (
                  <div key={member.id} className="flex items-center justify-between gap-3 text-sm">
                    {/* Checkbox and Avatar Name */}
                    <button
                      type="button"
                      onClick={() => handleToggleChecked(member.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition duration-150 ${
                          isChecked
                            ? 'bg-primary-container border-transparent text-surface'
                            : 'border-border-warm-grey'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span
                        className={`font-body-md ${
                          isChecked ? 'text-ink-text font-medium' : 'text-muted-text line-through'
                        }`}
                      >
                        {member.name}
                      </span>
                    </button>

                    {/* Split value modifiers */}
                    {isChecked && (
                      <div className="flex items-center gap-1.5">
                        {splitType === 'equal' && (
                          <span className="font-mono-price text-xs text-muted-text">
                            ₹{equalShare.toFixed(2)}
                          </span>
                        )}

                        {splitType === 'shares' && (
                          <div className="flex items-center gap-1 bg-surface border border-border-warm-grey px-2 py-1 rounded-lg">
                            <input
                              type="text"
                              value={weights[member.id] || ''}
                              onChange={(e) => handleWeightChange(member.id, e.target.value)}
                              placeholder="1"
                              className="w-10 bg-transparent text-center text-xs font-mono-price outline-none text-ink-text"
                            />
                            <span className="text-[10px] font-body-sm text-muted-text select-none">
                              {parseFloat(weights[member.id]) === 1 ? 'share' : 'shares'}
                            </span>
                          </div>
                        )}

                        {splitType === 'exact' && (
                          <div className="flex items-center gap-1 bg-surface border border-border-warm-grey px-2 py-1 rounded-lg">
                            <span className="text-xs text-secondary font-mono-price select-none">₹</span>
                            <input
                              type="text"
                              placeholder="0"
                              value={exactAmounts[member.id] || ''}
                              onChange={(e) => handleExactChange(member.id, e.target.value)}
                              className="w-16 bg-transparent text-right text-xs font-mono-price outline-none text-ink-text"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shares/Exact metadata totals */}
            {splitType === 'shares' && totalWeight > 0 && (
              <div className="text-[11px] font-body-sm text-muted-text border-t border-border-warm-grey pt-2 space-y-1">
                {checkedList.map((id) => {
                  const weightVal = parseFloat(weights[id]) || 0;
                  const shareAmt = (numericAmount * weightVal) / totalWeight;
                  const mName = activeMembers.find((m) => m.id === id)?.name;
                  return (
                    <div key={id} className="flex justify-between">
                      <span>{mName} share:</span>
                      <span className="font-mono-price">₹{shareAmt.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {splitType === 'exact' && (
              <div className="text-[11px] font-body-sm border-t border-border-warm-grey pt-2 flex justify-between items-center">
                <span>Sum: ₹{exactTotal.toFixed(2)}</span>
                {isExactSumValid ? (
                  <span className="text-[#1f4d3f] font-semibold flex items-center gap-0.5">
                    ✓ Matches total
                  </span>
                ) : (
                  <span className="text-secondary font-semibold">
                    Diff: ₹{Math.abs(numericAmount - exactTotal).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Submit button bar */}
        <div className="bg-card-cream p-4 border-t border-border-warm-grey shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-grow border border-border-warm-grey text-muted-text hover:text-ink-text font-body-md font-medium py-3 rounded-xl hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || (splitType === 'exact' && !isExactSumValid)}
            onClick={handleSave}
            className="flex-grow bg-primary-container hover:bg-primary disabled:bg-outline-variant text-surface font-body-md font-semibold py-3 rounded-xl shadow-sm transition duration-200"
          >
            {isSaving ? 'Saving...' : 'Save expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
