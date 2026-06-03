'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Phone, MapPin, ShieldAlert, Cloud, Navigation, Info, AlertTriangle, AlertCircle
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Trip } from '@/lib/types';

interface LocalInfoClientProps {
  trip: Trip;
  currentMember: { memberId: string; memberName: string; role: string; photoUrl: string | null } | null;
}

interface LocalInfoData {
  destination: string;
  universal: string;
  police: string;
  ambulance: string;
  hospitalName: string;
  hospitalLocation: string;
  hospitalDistance: string;
  hospitalPhone: string;
  touristHelpline: string;
}

export default function LocalInfoClient({ trip, currentMember }: LocalInfoClientProps) {
  const tripId = trip.id;
  const [info, setInfo] = useState<LocalInfoData | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    // 1. Check if we have cached data in localStorage first to render immediately
    const cached = localStorage.getItem(`junto_local_info_${tripId}`);
    if (cached) {
      setInfo(JSON.parse(cached));
      setIsCached(true);
    }

    // 2. Fetch fresh details from API
    const fetchLocalInfo = async () => {
      try {
        const res = await fetch(`/api/trip/${tripId}/local-info`);
        if (!res.ok) throw new Error('Failed to fetch local info');
        const data = await res.json();
        
        // Cache in localStorage
        localStorage.setItem(`junto_local_info_${tripId}`, JSON.stringify(data));
        setInfo(data);
        setIsCached(true);
        setIsOffline(false);
      } catch (err) {
        console.error('Error fetching local info, loading from offline cache:', err);
        setIsOffline(true);
        // If we don't have cached data, load fallback mock data
        if (!cached) {
          const fallbackData: LocalInfoData = {
            destination: trip.name,
            universal: '112',
            police: '100',
            ambulance: '108',
            hospitalName: 'Emergency Hospital',
            hospitalLocation: 'Nearest Central Facility',
            hospitalDistance: 'Checking location...',
            hospitalPhone: '112',
            touristHelpline: '1363'
          };
          setInfo(fallbackData);
        }
      }
    };

    fetchLocalInfo();

    // Setup network status listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [tripId, trip.name]);

  if (!info) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-center items-center max-w-md mx-auto w-full border-x border-border-warm-grey">
        <div className="animate-pulse text-muted-text text-sm font-label-caps">Loading local emergency data...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10 text-left">
        
        {/* Header App Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/trip/${tripId}/plan`} className="text-ink-text hover:text-secondary transition">
              <ChevronLeft className="w-5.5 h-5.5" />
            </Link>
            <div>
              <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Local info</h1>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-text font-body-sm">
                <MapPin className="w-3.5 h-3.5 text-[#a04018]" />
                <span>{info.destination} {isCached && '· saved offline'}</span>
              </div>
            </div>
          </div>
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

        {/* Offline Warning Banner */}
        {isOffline && (
          <div className="bg-secondary/10 border border-secondary/20 p-3.5 rounded-xl flex items-center gap-2.5 text-xs text-[#a04018] font-medium animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Running in offline mode. Viewing locally stored emergency contacts.</span>
          </div>
        )}

        {/* Primary SOS Emergency Card */}
        <div className="bg-card-cream border-2 border-secondary rounded-xl p-5 shadow-md flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 rotate-12">
            <ShieldAlert className="w-32 h-32 text-secondary" />
          </div>
          
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="font-label-caps text-[10px] text-secondary tracking-widest block mb-0.5">UNIVERSAL EMERGENCY</span>
              <h3 className="font-display text-5xl text-ink-text leading-none font-bold">{info.universal}</h3>
            </div>
            <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-white shrink-0 shadow-sm">
              <ShieldAlert className="w-5.5 h-5.5" />
            </div>
          </div>

          <a 
            href={`tel:${info.universal}`}
            className="w-full bg-secondary hover:bg-red-800 text-surface font-headline-sm text-center py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition duration-200"
          >
            <Phone className="w-4.5 h-4.5 fill-white text-white" />
            Call Now
          </a>
        </div>

        {/* Secondary Emergency Services Grid */}
        <div className="space-y-3">
          
          {/* Police */}
          <div className="bg-card-cream border border-border-warm-grey rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-[#1f4d3f] border border-border-warm-grey">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-muted-text leading-none mb-1">POLICE</p>
                <p className="font-headline-sm text-base text-ink-text leading-none font-bold">{info.police}</p>
              </div>
            </div>
            <a 
              href={`tel:${info.police}`}
              className="p-2.5 rounded-full bg-primary-container text-surface hover:bg-primary transition shadow-xs"
            >
              <Phone className="w-4.5 h-4.5" />
            </a>
          </div>

          {/* Ambulance */}
          <div className="bg-card-cream border border-border-warm-grey rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-[#1f4d3f] border border-border-warm-grey">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-muted-text leading-none mb-1">AMBULANCE</p>
                <p className="font-headline-sm text-base text-ink-text leading-none font-bold">{info.ambulance}</p>
              </div>
            </div>
            <a 
              href={`tel:${info.ambulance}`}
              className="p-2.5 rounded-full bg-primary-container text-surface hover:bg-primary transition shadow-xs"
            >
              <Phone className="w-4.5 h-4.5" />
            </a>
          </div>

          {/* Tourist Helpline */}
          <div className="bg-card-cream border border-border-warm-grey rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-[#1f4d3f] border border-border-warm-grey">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-muted-text leading-none mb-1">TOURIST HELPLINE</p>
                <p className="font-headline-sm text-base text-ink-text leading-none font-bold">{info.touristHelpline}</p>
              </div>
            </div>
            <a 
              href={`tel:${info.touristHelpline}`}
              className="p-2.5 rounded-full bg-primary-container text-surface hover:bg-primary transition shadow-xs"
            >
              <Phone className="w-4.5 h-4.5" />
            </a>
          </div>

          {/* Nearest Hospital Bento Card */}
          <div className="bg-card-cream border border-border-warm-grey rounded-xl overflow-hidden shadow-xs flex flex-col">
            <div className="h-28 bg-[#ede8dc] relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-multiply filter grayscale" style={{ backgroundImage: "url('https://maps.googleapis.com/maps/api/staticmap?center=Dona+Paula,Goa&zoom=13&size=400x150&sensor=false')" }} />
              <div className="bg-surface p-2.5 rounded-full shadow-md border border-border-warm-grey z-10 text-secondary">
                <ShieldAlert className="w-6 h-6 fill-secondary" />
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div>
                <p className="font-label-caps text-[9px] text-muted-text mb-1">NEAREST HOSPITAL</p>
                <h4 className="font-headline-sm text-base text-ink-text font-bold leading-tight">{info.hospitalName}</h4>
                <p className="font-body-sm text-xs text-muted-text mt-0.5">{info.hospitalLocation} · {info.hospitalDistance}</p>
              </div>
              
              <div className="flex gap-2">
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.hospitalName + ' ' + info.hospitalLocation)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-grow bg-primary hover:bg-primary-container text-surface font-label-caps text-[10px] py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Navigation className="w-3.5 h-3.5 fill-white" />
                  Directions
                </a>
                <a 
                  href={`tel:${info.hospitalPhone}`}
                  className="px-3 border border-border-warm-grey text-ink-text hover:bg-surface rounded-lg flex items-center justify-center transition"
                  title="Call Hospital"
                >
                  <Phone className="w-4 h-4 text-muted-text" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Offline Footer Note */}
        <footer className="flex items-center justify-center gap-1.5 py-4 opacity-80">
          <Cloud className="w-4.5 h-4.5 text-primary" />
          <p className="font-body-sm text-xs text-muted-text italic">Cached for offline — works without signal.</p>
        </footer>

      </div>

      {/* Bottom Nav Bar */}
      <BottomNav tripId={tripId} activeTab="plan" />
    </div>
  );
}
