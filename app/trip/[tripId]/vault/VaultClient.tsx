'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Folder, FileText, Upload, Calendar, X, AlertTriangle, 
  Check, Plane, Home, Compass, Phone, Download, ArrowRight, Loader2, Edit3, Trash2, ExternalLink, ChevronLeft
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Trip, Member, VaultItem } from '@/lib/types';
import { EmergencyShieldButton } from '@/components/EmergencyShieldButton';

interface VaultClientProps {
  trip: Trip;
  members: Member[];
  initialVaultItems: VaultItem[];
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
}

interface ValidationWarnings {
  isDuplicate: boolean;
  duplicateTitle?: string;
  isExpired: boolean;
  expiredDetails?: string;
  isPreviousDate: boolean;
  previousDetails?: string;
}

export default function VaultClient({
  trip,
  members,
  initialVaultItems,
  currentMember
}: VaultClientProps) {
  const router = useRouter();
  const [vaultItems, setVaultItems] = useState<VaultItem[]>(initialVaultItems);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // OCR Temp Output
  const [tempOcrData, setTempOcrData] = useState<{
    kind: 'flight' | 'stay' | 'activity' | 'contact' | 'other';
    fields: any;
    sourceFileUrl: string;
    ambiguousDateDetected: boolean;
  } | null>(null);

  // Details Modal & Edit Mode state
  const [selectedVaultItem, setSelectedVaultItem] = useState<VaultItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Editable Form fields
  const [formKind, setFormKind] = useState<'flight' | 'stay' | 'activity' | 'contact' | 'other'>('stay');
  const [formFields, setFormFields] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const tripId = trip.id;
  const currentMemberId = currentMember?.memberId || null;

  // Sync polling to update list
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trip/${tripId}/sync`);
        if (!res.ok) throw new Error('Sync failed');
        const syncData = await res.json();
        if (active && syncData.vaultItems) {
          setVaultItems(syncData.vaultItems);
        }
      } catch (err) {
        console.error('Error syncing vault:', err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tripId]);

  // Open details modal on load if URL parameter matches
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const openId = searchParams.get('open');
    if (openId && vaultItems.length > 0) {
      const found = vaultItems.find(item => item.id === openId);
      if (found) {
        handleOpenDetails(found);
      }
    }
  }, [vaultItems]);

  // Validation Warnings Calculator
  const getValidationWarnings = (
    kind: string,
    fields: any,
    items: VaultItem[],
    excludeId?: string
  ): ValidationWarnings => {
    const warnings: ValidationWarnings = {
      isDuplicate: false,
      isExpired: false,
      isPreviousDate: false
    };

    const getCleanDate = (val: string) => {
      if (!val) return null;
      // Normalise dates (e.g. YYYY-MM-DD)
      const isoMatch = val.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        return new Date(year, month, day);
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const otherItems = excludeId ? items.filter(item => item.id !== excludeId) : items;

    // 1. Duplicate check (PNR / ConfNo matching)
    const pnr = (fields.pnr || fields.confirmationNo || '').trim().toLowerCase();
    if (pnr) {
      const duplicatePnr = otherItems.find(item => {
        const op = (item.fields.pnr || item.fields.confirmationNo || '').trim().toLowerCase();
        return op === pnr;
      });
      if (duplicatePnr) {
        warnings.isDuplicate = true;
        warnings.duplicateTitle = `Confirmation/PNR "${pnr}" is already logged on another voucher.`;
      }
    }

    // Name + checkin date matching (stays)
    if (kind === 'stay' && fields.hotelName && fields.checkInDate) {
      const hotelName = fields.hotelName.trim().toLowerCase();
      const checkInDate = fields.checkInDate.trim();
      const duplicateStay = otherItems.find(item => {
        return item.kind === 'stay' &&
               item.fields.hotelName?.trim().toLowerCase() === hotelName &&
               item.fields.checkInDate?.trim() === checkInDate;
      });
      if (duplicateStay) {
        warnings.isDuplicate = true;
        warnings.duplicateTitle = `A stay at "${fields.hotelName}" check-in ${fields.checkInDate} is already logged.`;
      }
    }

    // Flight matching
    if (kind === 'flight' && fields.flightNo && fields.departureDate) {
      const flightNo = fields.flightNo.trim().toLowerCase();
      const depDate = fields.departureDate.trim();
      const duplicateFlight = otherItems.find(item => {
        return item.kind === 'flight' &&
               item.fields.flightNo?.trim().toLowerCase() === flightNo &&
               item.fields.departureDate?.trim() === depDate;
      });
      if (duplicateFlight) {
        warnings.isDuplicate = true;
        warnings.duplicateTitle = `Flight "${fields.flightNo}" departing ${fields.departureDate} is already logged.`;
      }
    }

    // 2. Expired check (Date is in the past relative to today)
    const checkIn = getCleanDate(fields.checkInDate);
    const departure = getCleanDate(fields.departureDate);
    const generalDate = getCleanDate(fields.date);
    const targetDate = checkIn || departure || generalDate;

    if (targetDate && targetDate < today) {
      warnings.isExpired = true;
      const fmt = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      warnings.expiredDetails = `This voucher date (${fmt}) is in the past (expired).`;
    }

    // 3. Previous date checks (check-out before check-in)
    if (kind === 'stay' && fields.checkInDate && fields.checkOutDate) {
      const inDate = getCleanDate(fields.checkInDate);
      const outDate = getCleanDate(fields.checkOutDate);
      if (inDate && outDate && outDate < inDate) {
        warnings.isPreviousDate = true;
        warnings.previousDetails = `Check-out date is scheduled before the check-in date.`;
      }
    }

    // Before earliest existing booking date
    if (targetDate && otherItems.length > 0) {
      let earliestDate: Date | null = null;
      for (const item of otherItems) {
        const d = getCleanDate(item.fields.checkInDate || item.fields.departureDate || item.fields.date);
        if (d) {
          if (!earliestDate || d.getTime() < earliestDate.getTime()) {
            earliestDate = d;
          }
        }
      }

      if (earliestDate && targetDate.getTime() < earliestDate.getTime()) {
        warnings.isPreviousDate = true;
        const fmtEarliest = earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        warnings.previousDetails = `This date is scheduled before your earliest logged booking (${fmtEarliest}).`;
      }
    }

    return warnings;
  };

  const handleOpenDetails = (item: VaultItem) => {
    setSelectedVaultItem(item);
    setFormKind(item.kind);
    setFormFields(item.fields || {});
    setIsEditingMode(false);
    setShowDetailsModal(true);
  };

  // Handle file select & OCR trigger
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/trip/${tripId}/voucher`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('OCR Parsing failed');
      const data = await res.json();

      setTempOcrData(data);
      setFormKind(data.kind);
      setFormFields(data.fields || {});
      setShowConfirmModal(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to analyze voucher. Please try again.');
    } finally {
      setIsUploading(false);
      // reset file input
      e.target.value = '';
    }
  };

  // Handle save confirmed item (POST)
  const handleSaveConfirmed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (hasWarnings) {
      const warningsList = [];
      if (currentWarnings.isDuplicate) warningsList.push(`• ${currentWarnings.duplicateTitle}`);
      if (currentWarnings.isExpired) warningsList.push(`• ${currentWarnings.expiredDetails}`);
      if (currentWarnings.isPreviousDate) warningsList.push(`• ${currentWarnings.previousDetails}`);
      
      const proceed = window.confirm(
        `Are you sure you want to add this voucher? The following validation warning(s) were detected:\n\n${warningsList.join('\n')}`
      );
      if (!proceed) return;
    }

    setIsSaving(true);
    try {
      const payload = {
        kind: formKind,
        docType: tempOcrData?.sourceFileUrl?.match(/\.(pdf)$/i) ? 'pdf' : 'image',
        sourceFileUrl: tempOcrData?.sourceFileUrl || null,
        fields: formFields,
      };

      const res = await fetch(`/api/trip/${tripId}/vault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save vault item');

      setShowConfirmModal(false);
      setTempOcrData(null);
      
      // Navigate to Itinerary to show timeline
      router.push(`/trip/${tripId}/itinerary`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save voucher details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle update item details (PUT)
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaultItem || isSaving) return;

    if (hasWarnings) {
      const warningsList = [];
      if (currentWarnings.isDuplicate) warningsList.push(`• ${currentWarnings.duplicateTitle}`);
      if (currentWarnings.isExpired) warningsList.push(`• ${currentWarnings.expiredDetails}`);
      if (currentWarnings.isPreviousDate) warningsList.push(`• ${currentWarnings.previousDetails}`);
      
      const proceed = window.confirm(
        `Are you sure you want to save these changes? The following validation warning(s) were detected:\n\n${warningsList.join('\n')}`
      );
      if (!proceed) return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/trip/${tripId}/vault`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultItemId: selectedVaultItem.id,
          kind: formKind,
          fields: formFields
        })
      });

      if (!res.ok) throw new Error('Failed to update item');

      setShowDetailsModal(false);
      setSelectedVaultItem(null);

      // Refresh local items immediately
      const syncRes = await fetch(`/api/trip/${tripId}/sync`);
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        setVaultItems(syncData.vaultItems);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update travel booking details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete item (DELETE)
  const handleDeleteItem = async () => {
    if (!selectedVaultItem || isDeleting) return;
    if (!confirm('Are you sure you want to delete this travel booking? This will remove it from the Itinerary timeline.')) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/trip/${tripId}/vault`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultItemId: selectedVaultItem.id
        })
      });

      if (!res.ok) throw new Error('Failed to delete item');

      // Update local state
      setVaultItems(prev => prev.filter(item => item.id !== selectedVaultItem.id));
      setShowDetailsModal(false);
      setSelectedVaultItem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete travel booking.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteItemDirectly = async (item: VaultItem) => {
    const itemName = item.fields.hotelName || item.fields.flightNo || item.fields.airline || item.fields.activityName || item.fields.title || 'this travel booking';
    if (!confirm(`Are you sure you want to delete "${itemName}"? This will remove it from the Itinerary timeline.`)) return;

    try {
      const res = await fetch(`/api/trip/${tripId}/vault`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultItemId: item.id
        })
      });

      if (!res.ok) throw new Error('Failed to delete item');

      setVaultItems(prev => prev.filter(v => v.id !== item.id));
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete travel booking.');
    }
  };

  // Group vault items
  const flights = vaultItems.filter(item => item.kind === 'flight');
  const stays = vaultItems.filter(item => item.kind === 'stay');
  const activities = vaultItems.filter(item => item.kind === 'activity');
  const contacts = vaultItems.filter(item => item.kind === 'contact' || item.kind === 'other');

  // Compute validation warnings for current input fields
  const currentWarnings = getValidationWarnings(
    formKind, 
    formFields, 
    vaultItems, 
    selectedVaultItem?.id
  );

  const hasWarnings = currentWarnings.isDuplicate || currentWarnings.isExpired || currentWarnings.isPreviousDate;

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Logistics</h1>
                <span className="font-body-sm text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold shrink-0">
                  {trip.name}
                </span>
                <Link 
                  href="/vault" 
                  className="text-[10px] text-secondary hover:underline font-bold font-label-caps bg-secondary/10 px-2 py-0.5 rounded shrink-0 transition"
                >
                  Switch Vault
                </Link>
              </div>
              <p className="font-body-sm text-muted-text">Upload bookings and build the timeline</p>
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
              href={`/trip/${tripId}/itinerary`}
              className="flex items-center gap-1 bg-[#1f4d3f]/10 text-[#1f4d3f] border border-[#1f4d3f]/20 hover:bg-[#1f4d3f]/20 py-2 px-4 rounded-full font-label-caps text-[10px] tracking-wide font-bold transition shadow-xs"
            >
              Itinerary <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Dash bordered upload box */}
        {currentMemberId ? (
          <div className="relative border-2 border-dashed border-border-warm-grey bg-card-cream/50 rounded-2xl p-6 text-center hover:bg-card-cream transition duration-300 shadow-xs">
            {isUploading ? (
              <div className="flex flex-col items-center justify-center space-y-3 py-4">
                <Loader2 className="w-8 h-8 text-[#1f4d3f] animate-spin" />
                <div className="font-body-sm text-sm text-ink-text font-semibold">AI is analyzing voucher details...</div>
                <div className="font-body-sm text-xs text-muted-text">Extracting dates, flights & bookings</div>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-4">
                <div className="w-12 h-12 rounded-full bg-[#1f4d3f]/10 flex items-center justify-center text-[#1f4d3f]">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-body-md font-semibold text-[#1f4d3f] hover:underline">Upload a booking voucher</span>
                </div>
                <span className="font-body-sm text-xs text-muted-text">Supports PDF, PNG, JPG ticket confirmation</span>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            )}
          </div>
        ) : (
          <div className="bg-secondary/15 border border-dashed border-secondary/20 text-center font-body-sm text-secondary p-5 rounded-2xl">
            You must join the trip to upload travel documents.
          </div>
        )}

        {/* VAULT ITEMS LIST */}
        <div className="space-y-6">
          {vaultItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-2 opacity-50">
              <Folder className="w-10 h-10 text-muted-text" />
              <p className="font-body-sm text-sm text-muted-text">
                Your Vault is empty. Upload flights, hotel confirmations, or bookings.
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-left">
              {/* STAYS */}
              {stays.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-label-caps text-xs text-muted-text tracking-wider flex items-center gap-1.5 font-bold">
                    <Home className="w-3.5 h-3.5 text-[#1f4d3f]" /> STAYS
                  </h3>
                  <div className="space-y-2">
                    {stays.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleOpenDetails(item)}
                        className="bg-card-cream border border-border-warm-grey hover:border-outline cursor-pointer rounded-xl p-4 flex justify-between items-start shadow-xs transition group"
                      >
                        <div className="space-y-1">
                          <h4 className="font-body-md font-semibold text-ink-text leading-tight group-hover:text-primary transition">{item.fields.hotelName}</h4>
                          <p className="font-body-sm text-xs text-muted-text">
                            Check-in: {item.fields.checkInDate} {item.fields.checkOutDate && `· Check-out: ${item.fields.checkOutDate}`}
                          </p>
                          {item.fields.confirmationNo && (
                            <span className="inline-block text-[10px] bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded font-mono">
                              Conf: {item.fields.confirmationNo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {item.source_file_url && (
                            <a 
                              href={item.source_file_url} 
                              download 
                              className="text-muted-text hover:text-ink-text p-1.5 border border-border-warm-grey rounded-lg" 
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {currentMemberId && (
                            <button
                              onClick={() => handleDeleteItemDirectly(item)}
                              className="text-muted-text hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 p-1.5 border border-border-warm-grey rounded-lg transition cursor-pointer"
                              title="Delete Booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FLIGHTS */}
              {flights.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-label-caps text-xs text-muted-text tracking-wider flex items-center gap-1.5 font-bold">
                    <Plane className="w-3.5 h-3.5 text-[#1f4d3f]" /> FLIGHTS
                  </h3>
                  <div className="space-y-2">
                    {flights.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleOpenDetails(item)}
                        className="bg-card-cream border border-border-warm-grey hover:border-outline cursor-pointer rounded-xl p-4 flex justify-between items-start shadow-xs transition group"
                      >
                        <div className="space-y-1">
                          <h4 className="font-body-md font-semibold text-ink-text leading-tight group-hover:text-primary transition">
                            {item.fields.airline} {item.fields.flightNo}
                          </h4>
                          <p className="font-body-sm text-xs text-muted-text">
                            Departs: {item.fields.departureDate} {item.fields.departureTime && `at ${item.fields.departureTime}`}
                          </p>
                          {item.fields.departureAirport && item.fields.arrivalAirport && (
                            <p className="font-body-sm text-xs font-medium text-ink-text">
                              Route: {item.fields.departureAirport} → {item.fields.arrivalAirport}
                            </p>
                          )}
                          {item.fields.pnr && (
                            <span className="inline-block text-[10px] bg-[#1f4d3f]/10 text-[#1f4d3f] border border-[#1f4d3f]/20 px-2 py-0.5 rounded font-mono">
                              PNR: {item.fields.pnr}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {item.source_file_url && (
                            <a 
                              href={item.source_file_url} 
                              download 
                              className="text-muted-text hover:text-ink-text p-1.5 border border-border-warm-grey rounded-lg" 
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {currentMemberId && (
                            <button
                              onClick={() => handleDeleteItemDirectly(item)}
                              className="text-muted-text hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 p-1.5 border border-border-warm-grey rounded-lg transition cursor-pointer"
                              title="Delete Booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIVITIES */}
              {activities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-label-caps text-xs text-muted-text tracking-wider flex items-center gap-1.5 font-bold">
                    <Compass className="w-3.5 h-3.5 text-[#1f4d3f]" /> ACTIVITIES
                  </h3>
                  <div className="space-y-2">
                    {activities.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleOpenDetails(item)}
                        className="bg-card-cream border border-border-warm-grey hover:border-outline cursor-pointer rounded-xl p-4 flex justify-between items-start shadow-xs transition group"
                      >
                        <div className="space-y-1">
                          <h4 className="font-body-md font-semibold text-ink-text leading-tight group-hover:text-primary transition">{item.fields.activityName}</h4>
                          <p className="font-body-sm text-xs text-muted-text">
                            Date: {item.fields.date} {item.fields.time && `at ${item.fields.time}`}
                          </p>
                          {item.fields.location && (
                            <p className="font-body-sm text-xs text-ink-text">{item.fields.location}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {item.source_file_url && (
                            <a 
                              href={item.source_file_url} 
                              download 
                              className="text-muted-text hover:text-ink-text p-1.5 border border-border-warm-grey rounded-lg" 
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {currentMemberId && (
                            <button
                              onClick={() => handleDeleteItemDirectly(item)}
                              className="text-muted-text hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 p-1.5 border border-border-warm-grey rounded-lg transition cursor-pointer"
                              title="Delete Booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTACTS / OTHERS */}
              {contacts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-label-caps text-xs text-muted-text tracking-wider flex items-center gap-1.5 font-bold">
                    <Phone className="w-3.5 h-3.5 text-[#1f4d3f]" /> CONTACTS & OTHER
                  </h3>
                  <div className="space-y-2">
                    {contacts.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleOpenDetails(item)}
                        className="bg-card-cream border border-border-warm-grey hover:border-outline cursor-pointer rounded-xl p-4 flex justify-between items-start shadow-xs transition group"
                      >
                        <div className="space-y-1">
                          <h4 className="font-body-md font-semibold text-ink-text leading-tight group-hover:text-primary transition">
                            {item.fields.title || 'Other Booking'}
                          </h4>
                          <p className="font-body-sm text-xs text-muted-text">{item.fields.description}</p>
                          {item.fields.date && (
                            <p className="font-body-sm text-xs text-muted-text">Date: {item.fields.date}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {item.source_file_url && (
                            <a 
                              href={item.source_file_url} 
                              download 
                              className="text-muted-text hover:text-ink-text p-1.5 border border-border-warm-grey rounded-lg" 
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {currentMemberId && (
                            <button
                              onClick={() => handleDeleteItemDirectly(item)}
                              className="text-muted-text hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 p-1.5 border border-border-warm-grey rounded-lg transition cursor-pointer"
                              title="Delete Booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION OVERLAY MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-ink-text/30 backdrop-blur-xs flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-surface max-w-sm w-full rounded-2xl border border-border-warm-grey shadow-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-ink-text">Confirm Booking Details</h2>
              <button 
                onClick={() => { setShowConfirmModal(false); setTempOcrData(null); }}
                className="text-muted-text hover:text-ink-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Warnings Indicator inside Confirmation Modal */}
            {hasWarnings && (
              <div className="bg-secondary/15 border border-[#C2592F]/30 p-3.5 rounded-xl flex items-start gap-2.5 text-[#C2592F] text-xs">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-[#C2592F] mt-0.5" />
                <div className="space-y-1 text-left">
                  <span className="font-bold uppercase tracking-wider text-[9px] text-[#C2592F]">LOGISTICS WARNINGS</span>
                  {currentWarnings.isDuplicate && <p className="text-muted-text">• {currentWarnings.duplicateTitle}</p>}
                  {currentWarnings.isExpired && <p className="text-muted-text">• {currentWarnings.expiredDetails}</p>}
                  {currentWarnings.isPreviousDate && <p className="text-muted-text">• {currentWarnings.previousDetails}</p>}
                </div>
              </div>
            )}

            {/* Ambiguous Date Alert Indicator */}
            {tempOcrData?.ambiguousDateDetected && (
              <div className="bg-secondary/10 border border-secondary/20 p-3 rounded-xl flex items-start gap-2.5 text-secondary text-xs">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-[#C2592F] mt-0.5" />
                <div>
                  <span className="font-bold text-[#C2592F]">Date ambiguity detected!</span>
                  <p className="text-muted-text mt-0.5">Please check dates carefully. Is it DD/MM/YYYY or MM/DD/YYYY?</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveConfirmed} className="space-y-4 text-left">
              {/* Kind selection */}
              <div className="space-y-1">
                <label className="block font-label-caps text-muted-text text-[10px]">Booking Category</label>
                <select
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as any)}
                  className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-3 outline-none"
                >
                  <option value="stay">Hotel Stay</option>
                  <option value="flight">Flight</option>
                  <option value="activity">Activity</option>
                  <option value="contact">Contact</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Dynamic inputs based on Category */}
              {formKind === 'stay' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Hotel Name</label>
                    <input
                      type="text"
                      value={formFields.hotelName || ''}
                      onChange={(e) => setFormFields({ ...formFields, hotelName: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className={`space-y-1 p-2 rounded-xl border ${tempOcrData?.ambiguousDateDetected ? 'border-[#C2592F] bg-secondary/5' : 'border-transparent'}`}>
                    <label className="block font-label-caps text-muted-text text-[10px]">Check-in Date (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={formFields.checkInDate || ''}
                      onChange={(e) => setFormFields({ ...formFields, checkInDate: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className={`space-y-1 p-2 rounded-xl border ${tempOcrData?.ambiguousDateDetected ? 'border-[#C2592F] bg-secondary/5' : 'border-transparent'}`}>
                    <label className="block font-label-caps text-muted-text text-[10px]">Check-out Date (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={formFields.checkOutDate || ''}
                      onChange={(e) => setFormFields({ ...formFields, checkOutDate: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Confirmation Number</label>
                    <input
                      type="text"
                      value={formFields.confirmationNo || ''}
                      onChange={(e) => setFormFields({ ...formFields, confirmationNo: e.target.value })}
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Address</label>
                    <input
                      type="text"
                      value={formFields.address || ''}
                      onChange={(e) => setFormFields({ ...formFields, address: e.target.value })}
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                </div>
              )}

              {formKind === 'flight' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Airline Name</label>
                    <input
                      type="text"
                      value={formFields.airline || ''}
                      onChange={(e) => setFormFields({ ...formFields, airline: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Flight Number</label>
                    <input
                      type="text"
                      value={formFields.flightNo || ''}
                      onChange={(e) => setFormFields({ ...formFields, flightNo: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className={`space-y-1 p-2 rounded-xl border ${tempOcrData?.ambiguousDateDetected ? 'border-[#C2592F] bg-secondary/5' : 'border-transparent'}`}>
                    <label className="block font-label-caps text-muted-text text-[10px]">Departure Date (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={formFields.departureDate || ''}
                      onChange={(e) => setFormFields({ ...formFields, departureDate: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Departure Time</label>
                    <input
                      type="text"
                      value={formFields.departureTime || ''}
                      onChange={(e) => setFormFields({ ...formFields, departureTime: e.target.value })}
                      placeholder="e.g. 14:30 or 2:30 PM"
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Dep Airport</label>
                      <input
                        type="text"
                        value={formFields.departureAirport || ''}
                        onChange={(e) => setFormFields({ ...formFields, departureAirport: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Arr Airport</label>
                      <input
                        type="text"
                        value={formFields.arrivalAirport || ''}
                        onChange={(e) => setFormFields({ ...formFields, arrivalAirport: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">PNR / Conf Code</label>
                    <input
                      type="text"
                      value={formFields.pnr || ''}
                      onChange={(e) => setFormFields({ ...formFields, pnr: e.target.value })}
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                </div>
              )}

              {formKind === 'activity' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Activity Name</label>
                    <input
                      type="text"
                      value={formFields.activityName || ''}
                      onChange={(e) => setFormFields({ ...formFields, activityName: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className={`space-y-1 p-2 rounded-xl border ${tempOcrData?.ambiguousDateDetected ? 'border-[#C2592F] bg-secondary/5' : 'border-transparent'}`}>
                    <label className="block font-label-caps text-muted-text text-[10px]">Date (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={formFields.date || ''}
                      onChange={(e) => setFormFields({ ...formFields, date: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Time</label>
                    <input
                      type="text"
                      value={formFields.time || ''}
                      onChange={(e) => setFormFields({ ...formFields, time: e.target.value })}
                      placeholder="e.g. 10:00 AM"
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Location</label>
                    <input
                      type="text"
                      value={formFields.location || ''}
                      onChange={(e) => setFormFields({ ...formFields, location: e.target.value })}
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                </div>
              )}

              {formKind !== 'stay' && formKind !== 'flight' && formKind !== 'activity' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Title</label>
                    <input
                      type="text"
                      value={formFields.title || ''}
                      onChange={(e) => setFormFields({ ...formFields, title: e.target.value })}
                      required
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Date (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={formFields.date || ''}
                      onChange={(e) => setFormFields({ ...formFields, date: e.target.value })}
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-label-caps text-muted-text text-[10px]">Description</label>
                    <textarea
                      value={formFields.description || ''}
                      onChange={(e) => setFormFields({ ...formFields, description: e.target.value })}
                      className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm h-20"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowConfirmModal(false); setTempOcrData(null); }}
                  className="flex-1 border border-border-warm-grey text-muted-text hover:text-ink-text py-3 rounded-xl font-body-md font-medium text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-[#1f4d3f] hover:bg-primary text-surface font-body-md font-semibold py-3 rounded-xl text-center shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSaving ? 'Saving...' : (
                    <>
                      <Check className="w-4 h-4" /> Save Item
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS VIEW / EDIT / DELETE MODAL */}
      {showDetailsModal && selectedVaultItem && (
        <div className="fixed inset-0 bg-ink-text/30 backdrop-blur-xs flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-surface max-w-sm w-full rounded-2xl border border-border-warm-grey shadow-lg p-6 space-y-4 my-8">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-ink-text">
                {isEditingMode ? 'Edit Booking Details' : 'Booking Details'}
              </h2>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedVaultItem(null); setIsEditingMode(false); }}
                className="text-muted-text hover:text-ink-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Validation Warnings Indicator inside Details Modal */}
            {hasWarnings && (
              <div className="bg-secondary/15 border border-[#C2592F]/30 p-3.5 rounded-xl flex items-start gap-2.5 text-[#C2592F] text-xs">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-[#C2592F] mt-0.5" />
                <div className="space-y-1 text-left">
                  <span className="font-bold uppercase tracking-wider text-[9px] text-[#C2592F]">LOGISTICS WARNINGS</span>
                  {currentWarnings.isDuplicate && <p className="text-muted-text">• {currentWarnings.duplicateTitle}</p>}
                  {currentWarnings.isExpired && <p className="text-muted-text">• {currentWarnings.expiredDetails}</p>}
                  {currentWarnings.isPreviousDate && <p className="text-muted-text">• {currentWarnings.previousDetails}</p>}
                </div>
              </div>
            )}

            {isEditingMode ? (
              /* EDIT MODE FORM */
              <form onSubmit={handleUpdateItem} className="space-y-4 text-left">
                {/* Kind selection */}
                <div className="space-y-1">
                  <label className="block font-label-caps text-muted-text text-[10px]">Booking Category</label>
                  <select
                    value={formKind}
                    onChange={(e) => setFormKind(e.target.value as any)}
                    className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-3 outline-none"
                  >
                    <option value="stay">Hotel Stay</option>
                    <option value="flight">Flight</option>
                    <option value="activity">Activity</option>
                    <option value="contact">Contact</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Stays Fields */}
                {formKind === 'stay' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Hotel Name</label>
                      <input
                        type="text"
                        value={formFields.hotelName || ''}
                        onChange={(e) => setFormFields({ ...formFields, hotelName: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Check-in Date (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={formFields.checkInDate || ''}
                        onChange={(e) => setFormFields({ ...formFields, checkInDate: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Check-out Date (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={formFields.checkOutDate || ''}
                        onChange={(e) => setFormFields({ ...formFields, checkOutDate: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Confirmation Number</label>
                      <input
                        type="text"
                        value={formFields.confirmationNo || ''}
                        onChange={(e) => setFormFields({ ...formFields, confirmationNo: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Address</label>
                      <input
                        type="text"
                        value={formFields.address || ''}
                        onChange={(e) => setFormFields({ ...formFields, address: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Flight Fields */}
                {formKind === 'flight' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Airline Name</label>
                      <input
                        type="text"
                        value={formFields.airline || ''}
                        onChange={(e) => setFormFields({ ...formFields, airline: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Flight Number</label>
                      <input
                        type="text"
                        value={formFields.flightNo || ''}
                        onChange={(e) => setFormFields({ ...formFields, flightNo: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Departure Date (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={formFields.departureDate || ''}
                        onChange={(e) => setFormFields({ ...formFields, departureDate: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Departure Time</label>
                      <input
                        type="text"
                        value={formFields.departureTime || ''}
                        onChange={(e) => setFormFields({ ...formFields, departureTime: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block font-label-caps text-muted-text text-[10px]">Dep Airport</label>
                        <input
                          type="text"
                          value={formFields.departureAirport || ''}
                          onChange={(e) => setFormFields({ ...formFields, departureAirport: e.target.value })}
                          className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-label-caps text-muted-text text-[10px]">Arr Airport</label>
                        <input
                          type="text"
                          value={formFields.arrivalAirport || ''}
                          onChange={(e) => setFormFields({ ...formFields, arrivalAirport: e.target.value })}
                          className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">PNR / Conf Code</label>
                      <input
                        type="text"
                        value={formFields.pnr || ''}
                        onChange={(e) => setFormFields({ ...formFields, pnr: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Activity Fields */}
                {formKind === 'activity' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Activity Name</label>
                      <input
                        type="text"
                        value={formFields.activityName || ''}
                        onChange={(e) => setFormFields({ ...formFields, activityName: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Date (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={formFields.date || ''}
                        onChange={(e) => setFormFields({ ...formFields, date: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Time</label>
                      <input
                        type="text"
                        value={formFields.time || ''}
                        onChange={(e) => setFormFields({ ...formFields, time: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Location</label>
                      <input
                        type="text"
                        value={formFields.location || ''}
                        onChange={(e) => setFormFields({ ...formFields, location: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Other categories */}
                {formKind !== 'stay' && formKind !== 'flight' && formKind !== 'activity' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Title</label>
                      <input
                        type="text"
                        value={formFields.title || ''}
                        onChange={(e) => setFormFields({ ...formFields, title: e.target.value })}
                        required
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Date (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={formFields.date || ''}
                        onChange={(e) => setFormFields({ ...formFields, date: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-label-caps text-muted-text text-[10px]">Description</label>
                      <textarea
                        value={formFields.description || ''}
                        onChange={(e) => setFormFields({ ...formFields, description: e.target.value })}
                        className="w-full bg-card-cream border border-border-warm-grey text-ink-text font-body-md rounded-xl p-2.5 outline-none focus:border-outline text-sm h-20"
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingMode(false)}
                    className="flex-1 border border-border-warm-grey text-muted-text hover:text-ink-text py-3 rounded-xl font-body-md font-medium text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-[#1f4d3f] hover:bg-primary text-surface font-body-md font-semibold py-3 rounded-xl text-center shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              /* READ-ONLY VIEW MODE */
              <div className="space-y-5 text-left text-sm">
                
                {/* Document details box */}
                <div className="bg-[#fff9ed] border border-border-warm-grey/50 rounded-xl p-4 space-y-3.5">
                  <div className="flex justify-between items-center border-b border-border-warm-grey/40 pb-2">
                    <span className="font-label-caps text-[10px] text-[#1f4d3f] font-bold">
                      {selectedVaultItem.kind.toUpperCase()} LOGISTICS
                    </span>
                    {selectedVaultItem.source_file_url && (
                      <a 
                        href={selectedVaultItem.source_file_url} 
                        download
                        className="text-[#1f4d3f] hover:underline font-bold text-xs flex items-center gap-1"
                      >
                        Voucher Attachment <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Render fields logically */}
                  {selectedVaultItem.kind === 'stay' && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-label-caps text-muted-text block">HOTEL STAY</span>
                        <span className="font-body-md font-semibold text-ink-text">{formFields.hotelName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">CHECK-IN</span>
                          <span className="font-body-sm font-medium">{formFields.checkInDate}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">CHECK-OUT</span>
                          <span className="font-body-sm font-medium">{formFields.checkOutDate}</span>
                        </div>
                      </div>
                      {formFields.confirmationNo && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">CONFIRMATION NO</span>
                          <span className="font-mono text-xs font-semibold">{formFields.confirmationNo}</span>
                        </div>
                      )}
                      {formFields.address && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">ADDRESS</span>
                          <span className="font-body-sm text-xs text-muted-text">{formFields.address}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedVaultItem.kind === 'flight' && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-label-caps text-muted-text block">FLIGHT</span>
                        <span className="font-body-md font-semibold text-ink-text">{formFields.airline} {formFields.flightNo}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">DATE</span>
                          <span className="font-body-sm font-medium">{formFields.departureDate}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">TIME</span>
                          <span className="font-body-sm font-medium">{formFields.departureTime || 'TBD'}</span>
                        </div>
                      </div>
                      {formFields.departureAirport && formFields.arrivalAirport && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">ROUTE</span>
                          <span className="font-body-sm font-medium">{formFields.departureAirport} → {formFields.arrivalAirport}</span>
                        </div>
                      )}
                      {formFields.pnr && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">PNR CODE</span>
                          <span className="font-mono text-xs font-bold text-[#1f4d3f]">{formFields.pnr}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedVaultItem.kind === 'activity' && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-label-caps text-muted-text block">ACTIVITY</span>
                        <span className="font-body-md font-semibold text-ink-text">{formFields.activityName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">DATE</span>
                          <span className="font-body-sm font-medium">{formFields.date}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">TIME</span>
                          <span className="font-body-sm font-medium">{formFields.time || 'TBD'}</span>
                        </div>
                      </div>
                      {formFields.location && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">LOCATION</span>
                          <span className="font-body-sm text-xs text-muted-text">{formFields.location}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedVaultItem.kind !== 'stay' && selectedVaultItem.kind !== 'flight' && selectedVaultItem.kind !== 'activity' && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-label-caps text-muted-text block">TITLE</span>
                        <span className="font-body-md font-semibold text-ink-text">{formFields.title || 'Logistics Item'}</span>
                      </div>
                      {formFields.date && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">DATE</span>
                          <span className="font-body-sm font-medium">{formFields.date}</span>
                        </div>
                      )}
                      {formFields.description && (
                        <div>
                          <span className="text-[10px] font-label-caps text-muted-text block">DESCRIPTION</span>
                          <span className="font-body-sm text-xs text-muted-text leading-relaxed">{formFields.description}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modals Action buttons */}
                {currentMemberId && (
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setIsEditingMode(true)}
                      className="flex-1 border border-border-warm-grey text-[#1f4d3f] hover:text-primary py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Details
                    </button>
                    <button
                      onClick={handleDeleteItem}
                      disabled={isDeleting}
                      className="flex-1 border border-secondary/30 text-[#C2592F] hover:bg-secondary/5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" /> Delete Booking
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="vault" />
    </div>
  );
}
