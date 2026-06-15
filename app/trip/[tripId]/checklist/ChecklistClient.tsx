'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Check, Plus, Trash2, AlertCircle, Sparkles, ChevronLeft, Loader2, UserPlus, Info, X
} from 'lucide-react';
import { 
  getImportableTripsAction, 
  importChecklistAction, 
  assignChecklistItemAction 
} from './actions';
import BottomNav from '@/components/BottomNav';
import { Trip, Member, ChecklistItem } from '@/lib/types';
import { EmergencyShieldButton } from '@/components/EmergencyShieldButton';
import { getAviationRestriction, SEVERITY_LABEL, SEVERITY_COLOR } from '@/lib/aviation-restricted';

interface ChecklistClientProps {
  trip: Trip;
  members: Member[];
  initialChecklistItems: ChecklistItem[];
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
  hasFlights?: boolean;
}

export default function ChecklistClient({
  trip,
  members,
  initialChecklistItems,
  currentMember,
  hasFlights = false,
}: ChecklistClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>(initialChecklistItems);
  const [filter, setFilter] = useState<'everyone' | 'mine' | 'shared'>('everyone');
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<'personal' | 'shared'>('personal');
  const [newAssignedTo, setNewAssignedTo] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiSuggestion, setShowAiSuggestion] = useState(true);

  // New features state
  const [importableTrips, setImportableTrips] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeAssigneeItemId, setActiveAssigneeItemId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

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
        if (active && data.checklistItems) {
          setItems(data.checklistItems);
        }
      } catch (err) {
        console.error('Error polling checklist items:', err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tripId]);

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/trip/${tripId}/sync`);
      if (res.ok) {
        const data = await res.json();
        if (data.checklistItems) {
          setItems(data.checklistItems);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle item done status
  const handleToggle = async (item: ChecklistItem) => {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/trip/${tripId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          done: !item.done
        })
      });

      if (!res.ok) throw new Error('Toggle failed');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to update item.');
    }
  };

  // Add new item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || isAdding || !currentMemberId) return;

    setIsAdding(true);
    try {
      const res = await fetch(`/api/trip/${tripId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          category: newCategory,
          assignedTo: newCategory === 'shared' ? (newAssignedTo || null) : currentMemberId,
          perPerson: false
        })
      });

      if (!res.ok) throw new Error('Add failed');
      setNewLabel('');
      setNewAssignedTo('');
      setShowAddModal(false);
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to add item.');
    } finally {
      setIsAdding(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (item: ChecklistItem) => {
    if (!currentMemberId) return;

    if (item.source !== 'ai_chat') {
      if (!confirm('Are you sure you want to delete this item?')) return;
    }

    try {
      const res = await fetch(`/api/trip/${tripId}/checklist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });

      if (!res.ok) throw new Error('Delete failed');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete item.');
    }
  };

  // Add AI suggestion
  const handleAddSuggestion = async (label: string, category: 'personal' | 'shared') => {
    if (!currentMemberId) return;
    try {
      const res = await fetch(`/api/trip/${tripId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          category,
          assignedTo: category === 'shared' ? null : currentMemberId
        })
      });

      if (!res.ok) throw new Error('Failed to add suggestion');
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to add suggested item.');
    }
  };

  // Open import past trip checklist modal
  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    try {
      const res = await getImportableTripsAction(tripId);
      if (res.trips) {
        setImportableTrips(res.trips);
      } else if (res.error) {
        console.error(res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Import checklist from a past trip
  const handleImportChecklist = async (sourceTripId: string) => {
    setIsImporting(true);
    try {
      const res = await importChecklistAction(tripId, sourceTripId);
      if (res.error) {
        alert(res.error);
      } else {
        setShowImportModal(false);
        await refreshData();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to import checklist.');
    } finally {
      setIsImporting(false);
    }
  };

  // Assign item to a member
  const handleAssignItem = async (itemId: string, assigneeId: string | null) => {
    setIsAssigning(true);
    try {
      const res = await assignChecklistItemAction(tripId, itemId, assigneeId);
      if (res.error) {
        alert(res.error);
      } else {
        setActiveAssigneeItemId(null);
        await refreshData();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to assign item.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filter === 'mine') {
      return item.assigned_to === currentMemberId;
    }
    if (filter === 'shared') {
      return item.category === 'shared';
    }
    return true; // everyone
  });

  const sharedGearItems = filteredItems.filter((i) => i.category === 'shared');
  const personalItems = filteredItems.filter((i) => i.category === 'personal');

  // Compute stats
  const totalCount = items.length;
  const packedCount = items.filter((i) => i.done).length;
  const progressPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  // Render priority check for specific items (like passport)
  const isHighPriority = (label: string) => {
    const low = label.toLowerCase();
    return low.includes('passport') || low.includes('visa') || low.includes('ticket') || low.includes('id');
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10">
        
        {/* Header App Bar */}
        <div className="sticky top-0 z-20 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-surface/95 backdrop-blur-xs border-b border-border-warm-grey/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/trip/${tripId}/plan`} className="text-ink-text hover:text-secondary transition">
              <ChevronLeft className="w-5.5 h-5.5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Essentials</h1>
                <span className="font-body-sm text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold shrink-0">
                  {trip.name}
                </span>
              </div>
              <p className="font-body-sm text-muted-text">Packing checklist for the group</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenImportModal}
              className="text-[10px] font-label-caps text-primary border border-primary/25 px-2 py-1 rounded-lg hover:bg-primary/5 transition font-semibold"
            >
              Import
            </button>
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
          </div>
        </div>

        {/* Progress Tally */}
        <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="font-label-caps text-xs text-muted-text">PACKING PROGRESS</span>
            <span className="font-mono-price text-sm text-primary font-bold">{packedCount} of {totalCount} packed</span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Aviation restrictions banner — only shown when the trip has flights */}
        {hasFlights && (() => {
          const restricted = items.filter(i => getAviationRestriction(i.label));
          if (restricted.length === 0) return null;
          const banned = restricted.filter(i => getAviationRestriction(i.label)?.severity === 'banned');
          return (
            <div className="bg-[#fff8ee] border border-[#f0a500]/30 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">✈️</span>
                <span className="font-label-caps text-xs font-bold text-[#7c4b00] tracking-wider">AIRLINE RESTRICTIONS</span>
              </div>
              <p className="font-body-sm text-xs text-[#7c4b00] leading-relaxed">
                {banned.length > 0
                  ? `${banned.length} item${banned.length > 1 ? 's' : ''} on your list ${banned.length > 1 ? 'are' : 'is'} banned from flights. `
                  : ''}
                {restricted.length - banned.length > 0
                  ? `${restricted.length - banned.length} item${restricted.length - banned.length > 1 ? 's have' : ' has'} packing rules (liquid limits, cabin-only, etc.).`
                  : ''}
                {' '}Items flagged below — tap for details.
              </p>
            </div>
          );
        })()}

        {/* Segmented Filter */}
        <nav className="flex bg-surface-container-low p-1 rounded-xl border border-border-warm-grey">
          <button 
            onClick={() => setFilter('everyone')}
            className={`flex-1 py-1.5 rounded-lg font-label-caps text-[10px] tracking-normal transition ${
              filter === 'everyone' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
            }`}
          >
            Everyone
          </button>
          <button 
            onClick={() => setFilter('mine')}
            className={`flex-grow py-1.5 rounded-lg font-label-caps text-[10px] tracking-normal transition ${
              filter === 'mine' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
            }`}
          >
            Mine
          </button>
          <button 
            onClick={() => setFilter('shared')}
            className={`flex-1 py-1.5 rounded-lg font-label-caps text-[10px] tracking-normal transition ${
              filter === 'shared' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
            }`}
          >
            Shared Gear
          </button>
        </nav>

        {/* Shared Gear Section */}
        {sharedGearItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-label-caps text-xs text-muted-text tracking-wider text-left uppercase">Shared Gear</h3>
            <div className="space-y-2">
              {sharedGearItems.map((item) => {
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-card-cream border border-border-warm-grey rounded-xl group transition-all gap-4"
                  >
                    <div 
                      onClick={() => handleToggle(item)}
                      className="flex items-center gap-3 cursor-pointer select-none flex-grow min-w-0"
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        item.done 
                          ? 'bg-primary border-primary text-surface' 
                          : 'border-primary'
                      }`}>
                        {item.done && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className={`font-body-md text-ink-text text-sm truncate ${item.done ? 'line-through opacity-50' : ''}`}>
                          {item.label}
                        </span>
                        {item.source === 'ai_chat' && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-[#1f4d3f] bg-ai-sage-tint border border-[#1f4d3f]/25 px-1.5 py-0.5 rounded-full font-label-caps mt-1 w-fit shrink-0">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI · from chat
                          </span>
                        )}
                        {hasFlights && (() => {
                          const r = getAviationRestriction(item.label);
                          if (!r) return null;
                          return (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[9px] border px-1.5 py-0.5 rounded-full font-label-caps mt-1 w-fit shrink-0 cursor-help ${SEVERITY_COLOR[r.severity]}`}
                              title={r.message}
                            >
                              {SEVERITY_LABEL[r.severity]}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right Hand Side Controls */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Assignee chip/button in everyone or shared views */}
                      {(filter === 'everyone' || filter === 'shared') && (
                        <div>
                          {item.assigned_to ? (
                            (() => {
                              const member = members.find((m) => m.id === item.assigned_to);
                              const firstName = member ? (member.name || 'Friend').split(' ')[0] : 'Friend';
                              return (
                                <button
                                  onClick={() => currentMemberId && setActiveAssigneeItemId(item.id)}
                                  className="flex items-center gap-1.5 bg-surface-container border border-border-warm-grey hover:bg-surface-container-high py-1 px-2.5 rounded-full text-xs font-body-sm font-medium transition"
                                  title="Change Assignee"
                                >
                                  {member?.photo_url ? (
                                    <img 
                                      src={member.photo_url} 
                                      alt={firstName} 
                                      className="w-4 h-4 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {firstName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  <span className="text-ink-text">{firstName}</span>
                                </button>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() => currentMemberId && setActiveAssigneeItemId(item.id)}
                              className="flex items-center gap-1 text-muted-text border border-dashed border-border-warm-grey hover:bg-surface-container/50 py-1 px-2.5 rounded-full text-xs font-body-sm transition font-medium"
                              title="Assign Member"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-muted-text" />
                              <span>Assign</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Trash/delete action */}
                      {currentMemberId && (
                        <button 
                          onClick={() => handleDeleteItem(item)}
                          className={`text-muted-text hover:text-[#ba1a1a] transition-opacity p-1 ${
                            item.source === 'ai_chat' ? 'opacity-100 text-[#ba1a1a]' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Personal Section */}
        {personalItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-label-caps text-xs text-muted-text tracking-wider text-left uppercase">Personal</h3>
            <div className="space-y-2">
              {personalItems.map((item) => {
                const isUrgent = isHighPriority(item.label) && !item.done;
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-card-cream border border-border-warm-grey rounded-xl group transition-all gap-4"
                  >
                    <div 
                      onClick={() => handleToggle(item)}
                      className="flex items-center gap-3 cursor-pointer select-none flex-grow min-w-0"
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        item.done 
                          ? 'bg-primary border-primary text-surface' 
                          : 'border-primary'
                      }`}>
                        {item.done && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className={`font-body-md text-ink-text text-sm truncate ${item.done ? 'line-through opacity-50' : ''}`}>
                          {item.label}
                        </span>
                        {item.source === 'ai_chat' && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-[#1f4d3f] bg-ai-sage-tint border border-[#1f4d3f]/25 px-1.5 py-0.5 rounded-full font-label-caps mt-1 w-fit shrink-0">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI · from chat
                          </span>
                        )}
                        {hasFlights && (() => {
                          const r = getAviationRestriction(item.label);
                          if (!r) return null;
                          return (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[9px] border px-1.5 py-0.5 rounded-full font-label-caps mt-1 w-fit shrink-0 cursor-help ${SEVERITY_COLOR[r.severity]}`}
                              title={r.message}
                            >
                              {SEVERITY_LABEL[r.severity]}
                            </span>
                          );
                        })()}
                      </div>
                      {isUrgent && (
                        <span className="text-[#ba1a1a] flex items-center shrink-0 ml-1" title="High Priority Required">
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Right Hand Side Controls */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Assignee chip/button in everyone or shared views */}
                      {(filter === 'everyone' || filter === 'shared') && (
                        <div>
                          {item.assigned_to ? (
                            (() => {
                              const member = members.find((m) => m.id === item.assigned_to);
                              const firstName = member ? (member.name || 'Friend').split(' ')[0] : 'Friend';
                              return (
                                <button
                                  onClick={() => currentMemberId && setActiveAssigneeItemId(item.id)}
                                  className="flex items-center gap-1.5 bg-surface-container border border-border-warm-grey hover:bg-surface-container-high py-1 px-2.5 rounded-full text-xs font-body-sm font-medium transition"
                                  title="Change Assignee"
                                >
                                  {member?.photo_url ? (
                                    <img 
                                      src={member.photo_url} 
                                      alt={firstName} 
                                      className="w-4 h-4 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {firstName.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  <span className="text-ink-text">{firstName}</span>
                                </button>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() => currentMemberId && setActiveAssigneeItemId(item.id)}
                              className="flex items-center gap-1 text-muted-text border border-dashed border-border-warm-grey hover:bg-surface-container/50 py-1 px-2.5 rounded-full text-xs font-body-sm transition font-medium"
                              title="Assign Member"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-muted-text" />
                              <span>Assign</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Trash/delete action */}
                      {currentMemberId && (
                        <button 
                          onClick={() => handleDeleteItem(item)}
                          className={`text-muted-text hover:text-[#ba1a1a] transition-opacity p-1 ${
                            item.source === 'ai_chat' ? 'opacity-100 text-[#ba1a1a]' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="space-y-4">
            <button
              onClick={handleOpenImportModal}
              className="w-full bg-card-cream border border-dashed border-primary/30 hover:border-primary rounded-2xl p-6 text-center text-primary font-body-sm font-semibold flex flex-col items-center justify-center gap-2 group transition"
            >
              <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform text-primary shrink-0" />
              <span>Start from a previous trip →</span>
              <span className="text-[10px] text-muted-text font-normal font-body-sm">
                Reuse checklist items and categories from your past group trips
              </span>
            </button>
            <div className="bg-card-cream/60 border border-dashed border-border-warm-grey rounded-2xl p-8 text-center text-muted-text font-body-sm">
              No items in this list. Tap the + icon below to add essentials!
            </div>
          </div>
        )}

        {/* AI Suggestion Chip */}
        {showAiSuggestion && (
          <div className="mt-6 p-4 bg-ai-sage-tint border border-primary/20 rounded-xl flex flex-col gap-3 text-left relative">
            <button
              onClick={() => setShowAiSuggestion(false)}
              className="absolute top-3.5 right-3.5 text-muted-text hover:text-ink-text transition p-0.5 rounded-full hover:bg-black/5"
              title="Dismiss Suggestion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
              <span className="font-label-caps text-[10px] tracking-wider uppercase text-primary">AI Recommendation</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="font-body-sm text-ink-text leading-tight text-xs pr-6">
                Add insect repellent and sunscreen for the beach trip?
              </p>
              <button 
                onClick={async () => {
                  await handleAddSuggestion('Insect repellent', 'shared');
                  await handleAddSuggestion('Sunscreen', 'personal');
                  setShowAiSuggestion(false);
                }}
                className="bg-primary hover:bg-primary-container text-surface px-3 py-1.5 rounded-full font-label-caps text-[9px] hover:scale-105 transition-transform"
              >
                + Add
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Floating Action Button */}
      {currentMemberId && (
        <button 
          onClick={() => setShowAddModal(true)}
          className="absolute bottom-24 right-6 w-14 h-14 bg-primary text-surface rounded-full flex items-center justify-center shadow-lg active:scale-95 hover:scale-105 transition z-40"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-left">
            <h3 className="font-headline-sm text-ink-text">Add Essential Item</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-1">
                <label className="block font-label-caps text-muted-text text-[10px]">Item Label</label>
                <input 
                  type="text" 
                  placeholder="e.g. Toiletries, Sunglasses"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                  className="w-full bg-surface border border-border-warm-grey rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-label-caps text-muted-text text-[10px]">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory('personal')}
                    className={`py-2 rounded-lg border text-xs font-semibold font-body-sm transition ${
                      newCategory === 'personal'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border-warm-grey text-muted-text'
                    }`}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCategory('shared')}
                    className={`py-2 rounded-lg border text-xs font-semibold font-body-sm transition ${
                      newCategory === 'shared'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border-warm-grey text-muted-text'
                    }`}
                  >
                    Shared Gear
                  </button>
                </div>
              </div>

              {newCategory === 'shared' && (
                <div className="space-y-1">
                  <label className="block font-label-caps text-muted-text text-[10px]">Assignee (Optional)</label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full bg-surface border border-border-warm-grey rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.filter(m => m.status === 'confirmed').map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 bg-primary text-surface font-body-sm font-bold py-2 rounded-lg text-xs shadow-sm flex items-center justify-center"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Item'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewLabel('');
                    setNewAssignedTo('');
                  }}
                  className="flex-1 border border-border-warm-grey text-muted-text font-body-sm py-2 rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Checklist Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-left">
            <h3 className="font-headline-sm text-ink-text font-bold">Import Checklist</h3>
            <p className="font-body-sm text-xs text-muted-text">
              Select a past trip to import its checklist items.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {importableTrips.length === 0 ? (
                <div className="text-center font-body-sm text-xs text-muted-text py-4">
                  No other trips with checklists found.
                </div>
              ) : (
                importableTrips.map((pastTrip) => (
                  <button
                    key={pastTrip.id}
                    onClick={() => handleImportChecklist(pastTrip.id)}
                    disabled={isImporting}
                    className="w-full text-left bg-surface hover:bg-surface-container border border-border-warm-grey rounded-xl p-3.5 flex flex-col gap-1 transition"
                  >
                    <span className="font-body-md font-semibold text-ink-text text-sm">
                      {pastTrip.name}
                    </span>
                    <span className="text-[10px] text-muted-text font-body-sm">
                      Created: {new Date(pastTrip.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-full border border-border-warm-grey text-muted-text hover:text-ink-text font-body-sm py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignee Picker Modal */}
      {activeAssigneeItemId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-left">
            <h3 className="font-headline-sm text-ink-text font-bold">Assign Responsibility</h3>
            <p className="font-body-sm text-xs text-muted-text">
              Select a trip member to assign this item to.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {/* Option to Unassign */}
              <button
                onClick={() => handleAssignItem(activeAssigneeItemId, null)}
                disabled={isAssigning}
                className="w-full text-left bg-surface hover:bg-surface-container border border-border-warm-grey rounded-xl p-3 flex items-center justify-between transition"
              >
                <span className="font-body-sm text-secondary font-semibold text-xs">Unassigned</span>
                <span className="text-[10px] text-muted-text">Clear</span>
              </button>

              {/* Members List */}
              {members.map((member) => {
                const firstName = (member.name || 'Friend').split(' ')[0];
                return (
                  <button
                    key={member.id}
                    onClick={() => handleAssignItem(activeAssigneeItemId, member.id)}
                    disabled={isAssigning}
                    className="w-full text-left bg-surface hover:bg-surface-container border border-border-warm-grey rounded-xl p-3 flex items-center gap-2.5 transition"
                  >
                    {member.photo_url ? (
                      <img 
                        src={member.photo_url} 
                        alt={member.name || 'Friend'} 
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {firstName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex flex-col">
                      <span className="font-body-sm font-semibold text-ink-text text-xs">
                        {member.name}
                      </span>
                      <span className="text-[9px] text-muted-text font-label-caps tracking-wider">
                        {member.roles.join(', ') || 'member'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveAssigneeItemId(null)}
                className="w-full border border-border-warm-grey text-muted-text hover:text-ink-text font-body-sm py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <BottomNav tripId={tripId} activeTab="plan" />
    </div>
  );
}
