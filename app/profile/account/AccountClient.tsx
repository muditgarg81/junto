'use strict';

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, PersonStanding, Mail, Phone, Coins, Landmark, 
  Lock, Laptop, Download, Trash2, ArrowRight, Loader2, Save, X, Eye, AlertCircle
} from 'lucide-react';

interface UserProfile {
  name: string;
  email: string;
  phone: string | null;
  upi_id: string | null;
  home_currency: string | null;
  photo_url: string | null;
  chat_prefs: any;
  auth_id?: string | null;
}

interface AccountClientProps {
  initialUser: UserProfile;
}

export default function AccountClient({ initialUser }: AccountClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Modal States
  const [activeEditField, setActiveEditField] = useState<keyof UserProfile | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [unsettledTrips, setUnsettledTrips] = useState<{ tripName: string; balance: number }[]>([]);

  const handleOpenEdit = (field: keyof UserProfile, label: string) => {
    setActiveEditField(field);
    setEditValue(String(user[field] || ''));
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditField || isSaving) return;

    setIsSaving(true);
    const updatedUser = { ...user, [activeEditField]: editValue };

    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          upiId: updatedUser.upi_id,
          homeCurrency: updatedUser.home_currency,
          photoUrl: updatedUser.photo_url
        })
      });

      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setUser(data);
      setActiveEditField(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export User Data
  const handleExportData = () => {
    window.open('/api/user/export');
  };

  // Delete Account Process
  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      // 1. Pre-check for unsettled balances
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'precheck' })
      });

      if (!res.ok) throw new Error('Precheck failed');
      const data = await res.json();

      if (data.hasUnsettledBalances) {
        setUnsettledTrips(data.unsettledTrips);
        setShowWarningModal(true);
        setIsDeleting(false);
      } else {
        // Confirm deletion
        const confirmed = confirm(
          "Are you sure you want to delete your account?\n\nThis will remove your personal data. Past group trips and expenses you shared stay visible as 'Former member' so group ledgers are preserved."
        );
        if (confirmed) {
          const deleteRes = await fetch('/api/user/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete' })
          });

          if (!deleteRes.ok) throw new Error('Deletion failed');
          alert('Your account and profile details have been erased.');
          router.push('/');
        } else {
          setIsDeleting(false);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to process deletion request.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10 text-left">
        
        {/* Header App Bar */}
        <div className="flex items-center gap-3">
          <Link href="/profile" className="text-ink-text hover:text-secondary transition">
            <ChevronLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Account</h1>
            <p className="font-body-sm text-muted-text">Manage your credentials & profile settings</p>
          </div>
        </div>

        {/* Group 1: Editable Rows */}
        <section className="space-y-3">
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl overflow-hidden divide-y divide-border-warm-grey/50 shadow-xs">
            
            {/* Name */}
            <button 
              onClick={() => handleOpenEdit('name', 'Name')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-4">
                <PersonStanding className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">NAME</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">{user.name}</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

            {/* Photo */}
            <button 
              onClick={() => handleOpenEdit('photo_url', 'Photo URL')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-4">
                <PersonStanding className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">PHOTO</p>
                  <div className="mt-1 w-10 h-10 rounded-full border border-border-warm-grey overflow-hidden shadow-xs">
                    <img 
                      alt={user.name} 
                      className="w-full h-full object-cover"
                      src={user.photo_url || '/default-avatar.png'}
                    />
                  </div>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

            {/* Email */}
            <button 
              onClick={() => handleOpenEdit('email', 'Email Address')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-4">
                <Mail className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">EMAIL</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">{user.email}</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

            {/* Phone */}
            <button 
              onClick={() => handleOpenEdit('phone', 'Phone Number')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-4">
                <Phone className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">PHONE</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">
                    {user.phone ? user.phone : <span className="text-muted-text/50 italic font-normal">Not added</span>}
                  </p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

            {/* Home Currency */}
            <button 
              onClick={() => handleOpenEdit('home_currency', 'Home Currency')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-4">
                <Coins className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">HOME CURRENCY</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">{user.home_currency}</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

            {/* UPI ID */}
            <button 
              onClick={() => handleOpenEdit('upi_id', 'UPI ID')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-4">
                <Landmark className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">UPI ID</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">
                    {user.upi_id ? user.upi_id : <span className="text-muted-text/50 italic font-normal">Not added</span>}
                  </p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

          </div>
        </section>

        {/* Group 2: Security */}
        <section className="space-y-3">
          <h2 className="font-headline-sm text-lg text-ink-text px-1">Security</h2>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl overflow-hidden divide-y divide-border-warm-grey/50 shadow-xs">
            
            {/* Sign-in Method */}
            <div className="w-full flex items-center justify-between p-4 text-left">
              <div className="flex items-center gap-4">
                <Lock className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">SIGN-IN METHOD</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">
                    {user.auth_id?.startsWith('email-') ? 'Email Magic Link' : 'Google Auth'}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="w-full flex items-center justify-between p-4 text-left">
              <div className="flex items-center gap-4">
                <Laptop className="w-5 h-5 text-muted-text" />
                <div>
                  <p className="font-label-caps text-[9px] text-muted-text">ACTIVE SESSIONS</p>
                  <p className="font-body-md text-ink-text text-sm font-semibold">2 devices active</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-4 px-1">
            <span className="h-px flex-grow bg-secondary/20" />
            <h2 className="font-label-caps text-[10px] text-secondary tracking-widest uppercase shrink-0">DANGER ZONE</h2>
            <span className="h-px flex-grow bg-secondary/20" />
          </div>
          
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl overflow-hidden divide-y divide-border-warm-grey/50 shadow-xs">
            
            {/* Export Data */}
            <button 
              onClick={handleExportData}
              className="w-full flex items-start gap-4 p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <Download className="w-5 h-5 text-muted-text shrink-0 mt-0.5" />
              <div>
                <p className="font-body-md font-semibold text-ink-text text-sm">Export my data</p>
                <p className="text-xs text-muted-text mt-0.5">Download your trips, expenses, splits, and chat logs as JSON</p>
              </div>
            </button>

            {/* Delete Account */}
            <button 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full flex items-start gap-4 p-4 hover:bg-error-container/10 transition duration-150 text-left disabled:opacity-55"
            >
              <Trash2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="font-body-md font-bold text-secondary text-sm">Delete account</p>
                <p className="text-xs text-muted-text mt-0.5">Removes your profile. Past shared trips and expenses stay visible under Former member.</p>
              </div>
            </button>

          </div>
        </section>

      </div>

      {/* Edit Field Modal */}
      {activeEditField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-left">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-sm text-ink-text">Update Profile Detail</h3>
              <button onClick={() => setActiveEditField(null)} className="text-muted-text hover:text-ink-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveField} className="space-y-4">
              <div className="space-y-1">
                <label className="block font-label-caps text-muted-text text-[10px] uppercase">{String(activeEditField).replace('_', ' ')}</label>
                <input 
                  type="text" 
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  required={activeEditField === 'name' || activeEditField === 'email'}
                  className="w-full bg-surface border border-border-warm-grey rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-primary text-surface font-body-sm font-bold py-2 rounded-lg text-xs shadow-sm flex items-center justify-center gap-1"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save</>}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditField(null)}
                  className="flex-1 border border-border-warm-grey text-muted-text font-body-sm py-2 rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Warning Modal (Unsettled Balances) */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-left">
            <div className="flex items-center gap-2 text-secondary">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-headline-sm text-secondary font-bold">Unsettled Balances</h3>
            </div>
            <div className="space-y-3">
              <p className="font-body-sm text-ink-text text-sm leading-relaxed">
                You cannot delete your account yet because you have active, unsettled balances in these trips. Please settle up with your friends first:
              </p>
              <div className="bg-surface rounded-xl border border-border-warm-grey p-3 divide-y divide-border-warm-grey/50 max-h-40 overflow-y-auto">
                {unsettledTrips.map((t, idx) => (
                  <div key={idx} className="flex justify-between py-2 first:pt-0 last:pb-0 text-sm font-body-md">
                    <span className="font-semibold text-ink-text">{t.tripName}</span>
                    <span className={t.balance > 0 ? 'text-[#1f4d3f]' : 'text-[#a04018]'}>
                      {t.balance > 0 ? '+' : ''}₹{t.balance.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowWarningModal(false)}
              className="w-full bg-primary text-surface font-body-sm font-bold py-2.5 rounded-lg text-xs shadow-sm"
            >
              Understand
            </button>
          </div>
        </div>
      )}

      {/* Footer Nav back home */}
      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <Link href="/profile" className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold">
          ← Back to Hub
        </Link>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Profile Settings</span>
      </footer>
    </div>
  );
}
