'use strict';

import React from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { 
  User, Calendar, MessageSquare, Share2, HelpCircle, Shield, LogOut, ChevronRight, Settings
} from 'lucide-react';
import { logoutAction } from './actions';
import { BackButton } from '@/components/BackButton';

export default async function ProfileHubPage() {
  const user = await getCurrentUser(true) || {
    name: 'Mudit Garg',
    email: 'muditgarg81@gmail.com',
    photo_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC9tslox4ppPhb71H59NGSy_A4N-MZsnqGcwMUJfNSSFcXxIfofzSOFO51Pium1bHiV2mgi8_hBd3MzPYXAU9FjwpX2srdIZXWZcHc3DbjbnenBM2M2Hp8kjO_GEEX9FaFNkjBYiO8kJNhzBEOLeibFFverjXsQQ_sQlmxa9zcBzuXMytWDnBmG1cQUfj_LH20izh6nNAvEU79UgugTJlVtpmVpNeSfTZeNobKEpzrHP42XJraMLE_rmapsQWDsdfQECfc4cTXaSktW'
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <BackButton />
      <div className="flex-grow px-6 py-8 space-y-8 pb-24 z-10 text-left">
        
        {/* Profile Header Block */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border-warm-grey shadow-sm bg-card-cream relative group">
            <img 
              alt={user.name} 
              className="w-full h-full object-cover"
              src={user.photo_url || '/default-avatar.png'}
            />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl text-ink-text font-bold">{user.name}</h1>
            <Link 
              href="/profile/account" 
              className="font-label-caps text-[10px] text-secondary hover:underline font-bold"
            >
              Edit Settings
            </Link>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-6">
          
          {/* Section: YOU */}
          <div className="space-y-2">
            <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">YOU</h3>
            <div className="bg-card-cream border border-border-warm-grey rounded-2xl divide-y divide-border-warm-grey/50 overflow-hidden shadow-xs">
              <Link 
                href="/profile/account"
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <User className="w-5 h-5 text-muted-text" />
                  <span className="font-body-md text-ink-text text-sm">Account & profile</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text/40" />
              </Link>
              <Link 
                href="/profile/travels"
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <Calendar className="w-5 h-5 text-muted-text" />
                  <span className="font-body-md text-ink-text text-sm">Your travels</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text/40" />
              </Link>
            </div>
          </div>

          {/* Section: PREFERENCES */}
          <div className="space-y-2">
            <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">PREFERENCES</h3>
            <div className="bg-card-cream border border-border-warm-grey rounded-2xl divide-y divide-border-warm-grey/50 overflow-hidden shadow-xs">
              <Link 
                href="/profile/chats"
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <MessageSquare className="w-5 h-5 text-muted-text" />
                  <span className="font-body-md text-ink-text text-sm">Chats</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text/40" />
              </Link>
              <Link 
                href="/profile/sharing"
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <Share2 className="w-5 h-5 text-muted-text" />
                  <span className="font-body-md text-ink-text text-sm">Sharing & social</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text/40" />
              </Link>
            </div>
          </div>

          {/* Section: SUPPORT */}
          <div className="space-y-2">
            <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">SUPPORT</h3>
            <div className="bg-card-cream border border-border-warm-grey rounded-2xl divide-y divide-border-warm-grey/50 overflow-hidden shadow-xs">
              <Link 
                href="#"
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <HelpCircle className="w-5 h-5 text-muted-text" />
                  <span className="font-body-md text-ink-text text-sm">Help center</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text/40" />
              </Link>
              <Link 
                href="#"
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <Shield className="w-5 h-5 text-muted-text" />
                  <span className="font-body-md text-ink-text text-sm">Privacy policy</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text/40" />
              </Link>
            </div>
          </div>

          {/* Log Out Row */}
          <div className="pt-2">
            <form action={logoutAction}>
              <button 
                type="submit"
                className="w-full flex items-center gap-3.5 p-4 bg-card-cream border border-border-warm-grey rounded-2xl text-secondary hover:bg-red-500/5 active:scale-[0.99] duration-150 shadow-xs text-left"
              >
                <LogOut className="w-5 h-5 text-secondary" />
                <span className="font-body-md font-semibold text-sm">Log out</span>
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Footer Nav back home */}
      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <Link href="/" className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold">
          ← Back Home
        </Link>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Profile Hub</span>
      </footer>
    </div>
  );
}
