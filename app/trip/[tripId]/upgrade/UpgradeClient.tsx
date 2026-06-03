'use strict';

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Check, ShieldCheck, Loader2 } from 'lucide-react';
import { Trip, Member } from '@/lib/types';

interface UpgradeClientProps {
  trip: Trip;
  members: Member[];
  currentMember: { memberId: string; memberName: string; role: string } | null;
}

export default function UpgradeClient({
  trip,
  members,
  currentMember
}: UpgradeClientProps) {
  const router = useRouter();
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tripId = trip.id;
  const currentMemberId = currentMember?.memberId || null;

  const handleStartCheckout = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/trip/${tripId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: currentMemberId,
          provider,
          amount: provider === 'razorpay' ? 499.00 : 9.99
        })
      });

      if (!res.ok) throw new Error('Checkout initiation failed');
      const data = await res.json();

      if (data.checkoutUrl) {
        router.push(data.checkoutUrl);
      } else {
        throw new Error('No redirect URL returned');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to initialize payment checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    { title: 'Priority Gemini Vision OCR', desc: 'Fast parsing of hotel/flight receipts and vouchers.' },
    { title: 'Itinerary Connection Flags', desc: 'Auto-detect tight flights, overlays and booking conflicts.' },
    { title: 'Enriched AI suggestions', desc: 'Direct access to contextual activities matching group chats.' },
    { title: 'Group-wide upgrade', desc: 'Pay once, unlock premium access for every roster member!' }
  ];

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-8 pb-12 z-10">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/trip/${tripId}/plan`} className="text-ink-text hover:text-secondary transition">
            <ArrowLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Boost Trip</h1>
            <p className="font-body-sm text-muted-text">Upgrade your travel companion group workspace</p>
          </div>
        </div>

        {/* Hero visual */}
        <div className="bg-[#1f4d3f]/5 border border-[#1f4d3f]/10 rounded-2xl p-5 text-center space-y-3 relative overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-[#1f4d3f]/10 flex items-center justify-center text-[#1f4d3f] mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="font-headline-sm text-lg text-ink-text">Junto Boost</h2>
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-mono text-3xl font-extrabold text-[#1f4d3f]">
              {provider === 'razorpay' ? '₹499' : '$9.99'}
            </span>
            <span className="text-xs text-muted-text">/ one-time group fee</span>
          </div>
          <p className="font-body-sm text-xs text-muted-text leading-relaxed px-4">
            Unlock premium features for the whole group. Paid by you, enjoyed by everyone on the roster.
          </p>
        </div>

        {/* Benefits List */}
        <div className="space-y-4">
          <h3 className="font-label-caps text-xs text-muted-text tracking-wider font-bold">UPGRADE ADVANTAGES</h3>
          <div className="space-y-3">
            {benefits.map((b, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#1f4d3f]/10 flex items-center justify-center shrink-0 text-[#1f4d3f] mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <h4 className="font-body-md font-semibold text-ink-text text-sm leading-snug">{b.title}</h4>
                  <p className="font-body-sm text-xs text-muted-text leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment options selection */}
        <div className="space-y-3">
          <h3 className="font-label-caps text-xs text-muted-text tracking-wider font-bold">PAYMENT GATEWAY</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setProvider('razorpay')}
              className={`p-3.5 rounded-xl border text-center transition ${
                provider === 'razorpay' 
                  ? 'border-[#1f4d3f] bg-[#1f4d3f]/5 text-[#1f4d3f] font-bold shadow-xs' 
                  : 'border-border-warm-grey bg-card-cream/50 text-muted-text hover:border-outline'
              }`}
            >
              <span className="block text-xs font-body-sm">Razorpay (India)</span>
              <span className="block font-mono text-[10px] mt-0.5 opacity-80">UPI / Card</span>
            </button>
            <button
              onClick={() => setProvider('stripe')}
              className={`p-3.5 rounded-xl border text-center transition ${
                provider === 'stripe' 
                  ? 'border-[#1f4d3f] bg-[#1f4d3f]/5 text-[#1f4d3f] font-bold shadow-xs' 
                  : 'border-border-warm-grey bg-card-cream/50 text-muted-text hover:border-outline'
              }`}
            >
              <span className="block text-xs font-body-sm">Stripe (Global)</span>
              <span className="block font-mono text-[10px] mt-0.5 opacity-80">Cards / Wallet</span>
            </button>
          </div>
        </div>

        {/* Proceed CTA */}
        <button
          onClick={handleStartCheckout}
          disabled={isSubmitting}
          className="w-full bg-[#1f4d3f] hover:bg-primary text-surface font-body-md font-semibold py-3.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" /> Proceed to Checkout
            </>
          )}
        </button>

      </div>
    </div>
  );
}
