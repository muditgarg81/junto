'use strict';

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, Copy, Share, Shield, Link2, Eye, Compass,
  Camera, Plus, Trash2, X, ImageIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ScrapbookPhoto {
  id: string;
  url: string;
  caption: string | null;
  taken_at: string | null;
  uploader_name: string | null;
  created_at: string;
}

export default function SharingSettingsPage() {
  const router = useRouter();
  const [shareType, setShareType] = useState<'card' | 'collage' | 'photos'>('card');
  const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tripId, setTripId] = useState<string | null>(null);
  const [tripName, setTripName] = useState('Beach Escape');
  const [destination, setDestination] = useState('Goa, India');
  const [dates, setDates] = useState('Oct 12 - Oct 17');
  const [memberCount, setMemberCount] = useState(5);
  const [inviteToken, setInviteToken] = useState('goa-recap-2026');

  // Photos
  const [photos, setPhotos] = useState<ScrapbookPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ScrapbookPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/trip/${id}/photos`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('tripId');
    if (!id) return;
    setTripId(id);

    fetch(`/api/trip/${id}/sync`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.trip) { setTripName(data.trip.name); setInviteToken(data.trip.invite_token); }
        if (data.members) setMemberCount(data.members.length);
        if (data.decisions) {
          const destDec = data.decisions.find((d: any) => d.type === 'destination' && d.status === 'locked');
          if (destDec?.resolved_option_id) {
            const opt = destDec.options?.find((o: any) => o.id === destDec.resolved_option_id);
            if (opt) setDestination(opt.label);
          }
          const datesDec = data.decisions.find((d: any) => d.type === 'dates' && d.status === 'locked');
          if (datesDec?.resolved_option_id) {
            const opt = datesDec.options?.find((o: any) => o.id === datesDec.resolved_option_id);
            if (opt) setDates(opt.label);
          }
        }
      })
      .catch(() => {});

    fetchPhotos(id);
  }, [fetchPhotos]);

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${inviteToken}`
    : `https://junto-three.vercel.app/join/${inviteToken}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Check out our Junto trip scrapbook & journal for ${tripName}: ${shareLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareInstagram = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    alert('Scrapbook link copied! Opening Instagram so you can add it as a link sticker to your story.');
    window.open('https://instagram.com', '_blank');
  };

  const handleShareMore = () => {
    if (navigator.share) {
      navigator.share({
        title: `Junto Trip: ${tripName}`,
        text: `Check out our Junto trip scrapbook & journal for ${tripName}!`,
        url: shareLink,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !tripId) return;
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`/api/trip/${tripId}/photos`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) { alert('Failed to upload photo.'); break; }
      }
      await fetchPhotos(tripId);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photo: ScrapbookPhoto) => {
    if (!tripId || !confirm('Delete this photo?')) return;
    setSelectedPhoto(null);
    await fetch(`/api/trip/${tripId}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id }),
    });
    await fetchPhotos(tripId);
  };

  // Hero photo for journal card: first uploaded photo or placeholder
  const heroPhoto = photos[0]?.url ?? null;

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-28 z-10 text-left">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-ink-text hover:text-secondary transition p-1 bg-transparent border-none outline-none cursor-pointer"
          >
            <ChevronLeft className="w-5.5 h-5.5" />
          </button>
          <div>
            <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Share trip</h1>
            <p className="font-body-sm text-muted-text">Design and export travel journals & scrapbook logs</p>
          </div>
        </div>

        {/* Journal Card Preview */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[240px] aspect-[9/16] bg-[#023629] text-surface rounded-2xl p-5 flex flex-col justify-between relative shadow-md overflow-hidden border border-border-warm-grey/25 select-none">
            <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 rotate-45">
              <Compass className="w-60 h-60 text-white" />
            </div>
            <div className="flex justify-between items-start z-10">
              <span className="font-label-caps text-[9px] tracking-widest text-[#8dbdab]">{destination.toUpperCase()}</span>
              <span className="font-label-caps text-[8px] bg-secondary text-white px-2 py-0.5 rounded-full font-semibold font-body-sm uppercase">JOURNAL</span>
            </div>
            <div className="w-full h-36 rounded-xl overflow-hidden shadow-xs border border-white/10 z-10 my-4 bg-surface/10 flex items-center justify-center">
              {heroPhoto ? (
                <img src={heroPhoto} alt="Trip cover" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/30">
                  <ImageIcon className="w-8 h-8" />
                  <span className="font-body-sm text-[9px]">Add photos below</span>
                </div>
              )}
            </div>
            <div className="z-10 text-left space-y-1.5">
              <h2 className="font-display text-2xl font-bold leading-tight line-clamp-2">{tripName}</h2>
              <p className="font-body-sm text-[11px] text-[#8dbdab]">{dates} · {memberCount} members</p>
            </div>
            <div className="flex justify-between items-baseline z-10 pt-2 border-t border-white/10">
              <span className="font-display font-bold text-xs tracking-wider text-surface/90">Junto.</span>
              <span className="font-label-caps text-[7px] text-surface/60">ONE LIVING TRIP PLAN</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-container-low p-1 rounded-xl border border-border-warm-grey">
          {(['card', 'collage', 'photos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setShareType(tab)}
              className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                shareType === tab ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
              }`}
            >
              {tab === 'card' ? 'Journal Card' : tab === 'collage' ? 'Collage' : 'Single Photos'}
            </button>
          ))}
        </div>

        {/* ── PHOTOS SECTION ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase">
              TRIP PHOTOS · {photos.length}
            </h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !tripId}
              className="flex items-center gap-1.5 bg-primary-container text-surface font-label-caps text-[9px] px-3 py-1.5 rounded-lg shadow-sm hover:bg-primary transition disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              {uploading ? 'Uploading…' : 'Add Photos'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {photos.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !tripId}
              className="w-full border-2 border-dashed border-border-warm-grey rounded-2xl p-8 flex flex-col items-center gap-3 text-muted-text hover:border-secondary hover:text-secondary transition disabled:opacity-50"
            >
              <Camera className="w-8 h-8" />
              <span className="font-body-sm text-sm">Tap to add your first trip photo</span>
              <span className="font-body-sm text-[10px]">Photos appear on the journal card & collage</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="aspect-square rounded-xl overflow-hidden border border-border-warm-grey shadow-xs hover:opacity-90 transition"
                >
                  <img src={photo.url} alt={photo.caption || 'Trip photo'} className="w-full h-full object-cover" />
                </button>
              ))}
              {/* Add more tile */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !tripId}
                className="aspect-square rounded-xl border-2 border-dashed border-border-warm-grey flex items-center justify-center text-muted-text hover:border-secondary hover:text-secondary transition disabled:opacity-50"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}
        </section>

        {/* Export Targets */}
        <div className="space-y-3">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">EXPORT TARGETS</h3>
          <div className="grid grid-cols-4 gap-3">
            <button onClick={handleShareInstagram} className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm font-display font-bold text-xs">Insta</div>
              <span className="text-[9px] font-label-caps text-ink-text">Stories</span>
            </button>
            <button onClick={handleShareWhatsApp} className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm font-display font-bold text-xs">WA</div>
              <span className="text-[9px] font-label-caps text-ink-text">WhatsApp</span>
            </button>
            <button onClick={handleCopyLink} className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition">
              <div className="w-10 h-10 rounded-full bg-primary-container text-surface flex items-center justify-center shrink-0 shadow-sm"><Link2 className="w-5 h-5" /></div>
              <span className="text-[9px] font-label-caps text-ink-text">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <button onClick={handleShareMore} className="flex flex-col items-center justify-center p-3 bg-card-cream border border-border-warm-grey rounded-2xl gap-1.5 hover:border-outline active:scale-95 transition">
              <div className="w-10 h-10 rounded-full bg-surface-dim border border-border-warm-grey text-ink-text flex items-center justify-center shrink-0 shadow-sm"><Share className="w-5 h-5" /></div>
              <span className="text-[9px] font-label-caps text-ink-text">More</span>
            </button>
          </div>
        </div>

        {/* Public Sharing Link */}
        <section className="space-y-3 pt-2">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">PUBLIC SHARING LINK</h3>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Make this journal viewable by link</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={publicLinkEnabled} onChange={(e) => setPublicLinkEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-border-warm-grey peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            {publicLinkEnabled ? (
              <div className="space-y-3 pt-2.5 border-t border-border-warm-grey/50">
                <div className="flex items-center gap-2 bg-surface p-2.5 rounded-xl border border-border-warm-grey overflow-hidden">
                  <span className="text-xs text-muted-text select-all truncate font-mono-price flex-grow">{shareLink}</span>
                  <button onClick={handleCopyLink} className="p-2 bg-primary-container text-surface hover:bg-primary rounded-lg shrink-0 transition"><Copy className="w-3.5 h-3.5" /></button>
                </div>
                {copied && <p className="text-[10px] font-label-caps text-primary text-right font-bold">Link Copied!</p>}
                <div className="flex items-start gap-2.5 text-xs text-muted-text p-3 bg-secondary/5 rounded-xl border border-secondary/10">
                  <Shield className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-body-sm text-left">Anyone with the link can view. Photos of other trip members are included in the journal timeline.</p>
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

      {/* Footer */}
      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <button onClick={() => router.back()} className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold bg-transparent border-none p-0 cursor-pointer">← Back</button>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Scrapbook Sharing</span>
      </footer>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto.url} alt={selectedPhoto.caption || 'Photo'} className="w-full rounded-2xl shadow-xl" />
            {selectedPhoto.caption && (
              <p className="mt-2 text-white text-center font-body-sm text-sm">{selectedPhoto.caption}</p>
            )}
            <div className="flex justify-between mt-3">
              <button onClick={() => setSelectedPhoto(null)} className="text-white/70 hover:text-white flex items-center gap-1 font-body-sm text-xs">
                <X className="w-4 h-4" /> Close
              </button>
              <button onClick={() => handleDeletePhoto(selectedPhoto)} className="text-red-400 hover:text-red-300 flex items-center gap-1 font-body-sm text-xs">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
