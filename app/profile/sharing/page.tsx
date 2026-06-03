'use strict';

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Copy, Share, Shield, Link2, Eye, Compass, Heart, Award
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SharingSettingsPage() {
  const router = useRouter();
  const [shareType, setShareType] = useState<'card' | 'collage' | 'photos'>('card');
  const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareLink = "https://junto.plan/j/goa-recap-2026?token=7d8a9f0e";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10 text-left">
        
        {/* Header App Bar */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="text-ink-text hover:text-secondary transition p-1 bg-transparent border-none outline-none cursor-pointer flex items-center justify-center"
            title="Go back"
          >
            <ChevronLeft className="w-5.5 h-5.5" />
          </button>
          <div>
            <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Share trip</h1>
            <p className="font-body-sm text-muted-text">Design and export travel journals & scrapbook logs</p>
          </div>
        </div>

        {/* 1. Journal Card Story Preview */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[240px] aspect-[9/16] bg-[#023629] text-surface rounded-2xl p-5 flex flex-col justify-between relative shadow-md overflow-hidden border border-border-warm-grey/25 select-none">
            {/* Background design elements */}
            <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 rotate-45">
              <Compass className="w-60 h-60 text-white" />
            </div>
            
            <div className="flex justify-between items-start z-10">
              <span className="font-label-caps text-[9px] tracking-widest text-[#8dbdab]">GOA, INDIA</span>
              <span className="font-label-caps text-[8px] bg-secondary text-white px-2 py-0.5 rounded-full font-semibold font-body-sm uppercase">JOURNAL</span>
            </div>

            {/* Hero photo mockup */}
            <div className="w-full h-36 rounded-xl overflow-hidden shadow-xs border border-white/10 z-10 my-4">
              <img 
                alt="Goa beach" 
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCw-tfzJPADQylwIonDpwV_OBu9SaYdktCdMJFMfStBrmTnM-D3bqnYxHMTlGp5oOxYWgY-GXC16DpsG321vrfnzmej6j407_UV8e3lrhgCBN7LLo_VEbs9hCJ0CiTObAvLNzY0PRA9Rmet_b40-FK4F1zNO6WMLXrl6DAVgkToc_dwaF3cGQzBg-OIyAiMBvGIkGI3hefVSfhOVRESabUpRwvC3jWCWeB38R-QF9doVzWE6FixoWu_Ra4g7tVfd8goN1Zd2Do9lQ6E"
              />
            </div>

            <div className="z-10 text-left space-y-1.5">
              <h2 className="font-display text-2xl font-bold leading-tight">Beach Escape</h2>
              <p className="font-body-sm text-[11px] text-[#8dbdab]">Oct 12 - Oct 17 · 5 members</p>
            </div>

            <div className="flex justify-between items-baseline z-10 pt-2 border-t border-white/10">
              <span className="font-display font-bold text-xs tracking-wider text-surface/90">Junto.</span>
              <span className="font-label-caps text-[7px] text-surface/60">ONE LIVING TRIP PLAN</span>
            </div>
          </div>
        </div>

        {/* Segmented Controls for Export Type */}
        <div className="space-y-3">
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-border-warm-grey">
            <button
              onClick={() => setShareType('card')}
              className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                shareType === 'card' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
              }`}
            >
              Journal Card
            </button>
            <button
              onClick={() => setShareType('collage')}
              className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                shareType === 'collage' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
              }`}
            >
              Collage
            </button>
            <button
              onClick={() => setShareType('photos')}
              className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                shareType === 'photos' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
              }`}
            >
              Single Photos
            </button>
          </div>
        </div>

        {/* Large Round Share Targets */}
        <div className="space-y-3">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">EXPORT TARGETS</h3>
          <div className="grid grid-cols-4 gap-3">
            <button 
              onClick={() => alert('Launching Instagram Stories share intent...')}
              className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm font-display font-bold text-xs">Insta</div>
              <span className="text-[9px] font-label-caps text-ink-text">Stories</span>
            </button>
            <button 
              onClick={() => alert('Launching WhatsApp share intent...')}
              className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm font-display font-bold text-xs">WA</div>
              <span className="text-[9px] font-label-caps text-ink-text">WhatsApp</span>
            </button>
            <button 
              onClick={() => alert('Copying link...')}
              className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-full bg-primary-container text-surface flex items-center justify-center shrink-0 shadow-sm"><Link2 className="w-5 h-5" /></div>
              <span className="text-[9px] font-label-caps text-ink-text">Copy Link</span>
            </button>
            <button 
              onClick={() => alert('Opening OS Share sheet...')}
              className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-full bg-surface-dim border border-border-warm-grey text-ink-text flex items-center justify-center shrink-0 shadow-sm"><Share className="w-5 h-5" /></div>
              <span className="text-[9px] font-label-caps text-ink-text">More</span>
            </button>
          </div>
        </div>

        {/* Public Journal Share Link Section */}
        <section className="space-y-3 pt-2">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">PUBLIC SHARING LINK</h3>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-4 shadow-xs space-y-4">
            
            {/* Public Link Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Make this journal viewable by link</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={publicLinkEnabled} 
                  onChange={(e) => setPublicLinkEnabled(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-border-warm-grey peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Public Link Display and Warning */}
            {publicLinkEnabled ? (
              <div className="space-y-3 pt-2.5 border-t border-border-warm-grey/50">
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-xl border border-border-warm-grey overflow-hidden">
                  <span className="text-xs text-muted-text select-all truncate font-mono-price flex-grow">
                    {shareLink}
                  </span>
                  <button 
                    onClick={handleCopyLink}
                    className="p-2 bg-primary-container text-surface hover:bg-primary rounded-lg shrink-0 transition"
                    title="Copy Public Link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                {copied && <p className="text-[10px] font-label-caps text-primary text-right font-bold">Link Copied!</p>}
                
                <div className="flex items-start gap-2.5 text-xs text-muted-text p-3 bg-secondary/5 rounded-xl border border-secondary/10">
                  <Shield className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-body-sm text-left">
                    Anyone with the link can view. Photos of other trip members are included in the journal timeline.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-text leading-relaxed font-body-sm text-left pt-2 border-t border-border-warm-grey/50">
                Public links are disabled. Trip recollections are only accessible to confirmed roster members.
              </p>
            )}

          </div>
        </section>

      </div>

      {/* Footer Nav back home */}
      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <button 
          onClick={() => router.back()}
          className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
        >
          ← Back
        </button>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Scrapbook Sharing</span>
      </footer>
    </div>
  );
}
