'use strict';

import React from 'react';
import { Sparkles, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Offer } from '@/lib/types';

interface OfferCardProps {
  offer: Offer;
  currentMemberId?: string | null;
}

export default function OfferCard({ offer, currentMemberId }: OfferCardProps) {
  // Click routes through tracking redirect endpoint
  const trackingUrl = `/api/offer/${offer.id}/click?memberId=${currentMemberId || 'guest'}`;

  return (
    <div className="bg-card-cream border border-border-warm-grey/80 rounded-xl p-4 shadow-xs relative hover:border-outline transition flex flex-col justify-between space-y-3.5">
      {/* Sponsored/Affiliate Warning Badge */}
      <div className="flex justify-between items-center">
        <span className="font-label-caps text-[9px] text-[#C2592F] bg-[#C2592F]/10 border border-[#C2592F]/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> Sponsored option
        </span>
        <span className="font-label-caps text-[9px] text-muted-text bg-border-warm-grey/40 px-2 py-0.5 rounded">
          {offer.partner}
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="font-body-md font-bold text-ink-text leading-snug">
          {offer.title}
        </h4>
        <p className="text-[10px] font-body-sm text-muted-text">
          Junto partners guarantee zero price markups. Clicks help support our AI planners.
        </p>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-border-warm-grey/50">
        <div>
          <span className="text-[9px] font-label-caps text-muted-text block">BEST RATE</span>
          <span className="font-mono text-sm font-bold text-[#1f4d3f]">
            {offer.currency} {Number(offer.price).toLocaleString()}
          </span>
        </div>

        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#1f4d3f] hover:bg-primary text-surface font-body-sm font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-xs transition"
        >
          Book Choice <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
