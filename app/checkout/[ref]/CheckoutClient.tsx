'use strict';

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, CreditCard, Sparkles, XCircle } from 'lucide-react';

interface CheckoutClientProps {
  upgradeId: string;
  tripId: string;
  tripName: string;
  amount: number;
  provider: 'razorpay' | 'stripe';
}

export default function CheckoutClient({
  upgradeId,
  tripId,
  tripName,
  amount,
  provider
}: CheckoutClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'success' | 'failed' | null>(null);

  const handleSimulatePayment = async (status: 'success' | 'failed') => {
    setLoading(status);

    try {
      const providerRef = status === 'success' 
        ? `${provider === 'stripe' ? 'ch_' : 'pay_'}${crypto.randomUUID().substring(0, 16)}` 
        : 'fail_declined';

      const res = await fetch('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upgradeId,
          status,
          providerRef
        })
      });

      if (!res.ok) throw new Error('Webhook processing failed');

      // Go back to the plan page
      router.push(`/trip/${tripId}/plan`);
    } catch (err) {
      console.error(err);
      alert('Failed to simulate transaction hook. Returning to plan.');
      router.push(`/trip/${tripId}/plan`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff9ed] flex items-center justify-center p-6 font-sans">
      <div className="bg-surface max-w-sm w-full rounded-3xl border border-border-warm-grey shadow-lg p-6 space-y-6 text-center">
        {/* Hosted Provider Header banner */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container">
            <ShieldCheck className="w-6 h-6 text-[#1f4d3f]" />
          </div>
          <div className="font-label-caps text-xs text-muted-text font-bold tracking-wider">
            {provider.toUpperCase()} SECURE CHECKOUT
          </div>
          <h1 className="font-display text-2xl text-ink-text leading-tight">Junto Boost Upgrade</h1>
          <p className="font-body-sm text-xs text-muted-text max-w-[240px] mx-auto">
            Unlocking premium group features for <span className="font-semibold text-ink-text">{tripName}</span>
          </p>
        </div>

        {/* Pricing tag */}
        <div className="bg-[#fff9ed] border border-border-warm-grey/50 rounded-2xl p-4 flex justify-between items-center text-left">
          <div>
            <div className="text-[10px] font-label-caps text-secondary font-bold">UPGRADE TIER</div>
            <div className="font-body-md font-semibold text-ink-text flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#C2592F]" /> Boost Trip
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-label-caps text-muted-text font-semibold">TOTAL DUE</div>
            <div className="font-mono text-lg font-bold text-[#1f4d3f]">
              INR {amount}
            </div>
          </div>
        </div>

        {/* Mock card input fields to make it look hosted */}
        <div className="space-y-3 text-left">
          <div className="space-y-1">
            <label className="block font-label-caps text-muted-text text-[9px] font-bold">CARD NUMBER</label>
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="4111 2222 3333 4444"
                className="w-full bg-[#fff9ed]/50 border border-border-warm-grey/60 text-muted-text rounded-xl pl-10 pr-3 py-2.5 outline-none text-sm font-mono"
              />
              <CreditCard className="w-4 h-4 text-muted-text absolute left-3 top-3.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-label-caps text-muted-text text-[9px] font-bold">EXPIRY</label>
              <input
                type="text"
                disabled
                placeholder="12 / 29"
                className="w-full bg-[#fff9ed]/50 border border-border-warm-grey/60 text-muted-text rounded-xl px-3 py-2.5 outline-none text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-label-caps text-muted-text text-[9px] font-bold">CVV</label>
              <input
                type="text"
                disabled
                placeholder="***"
                className="w-full bg-[#fff9ed]/50 border border-border-warm-grey/60 text-muted-text rounded-xl px-3 py-2.5 outline-none text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Simulator controls */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={() => handleSimulatePayment('success')}
            disabled={loading !== null}
            className="w-full bg-[#1f4d3f] hover:bg-primary text-surface font-body-md font-semibold py-3 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
          >
            {loading === 'success' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Simulate Success
              </>
            )}
          </button>

          <button
            onClick={() => handleSimulatePayment('failed')}
            disabled={loading !== null}
            className="w-full border border-border-warm-grey/80 text-muted-text hover:text-ink-text py-3 rounded-xl font-body-md font-medium transition flex items-center justify-center gap-1.5"
          >
            {loading === 'failed' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <XCircle className="w-4 h-4 text-[#C2592F]" /> Simulate Declined
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
