'use strict';

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, BarChart2, TrendingUp, Cpu, Coins,
  Sparkles, Percent, PlusCircle, ArrowRight, Play, Loader2
} from 'lucide-react';
import { Trip, Offer } from '@/lib/types';
import { TripMetrics } from '@/lib/metrics';

interface MetricsClientProps {
  trip: Trip;
  metrics: TripMetrics;
  offers: Offer[];
}

export default function MetricsClient({
  trip,
  metrics: initialMetrics,
  offers: initialOffers
}: MetricsClientProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<TripMetrics>(initialMetrics);
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  
  // Postback Simulation Form State
  const [selectedOfferId, setSelectedOfferId] = useState(initialOffers[0]?.id || '');
  const [bookingAmount, setBookingAmount] = useState('8000');
  const [commissionAmount, setCommissionAmount] = useState('640');
  const [isSimulating, setIsSimulating] = useState(false);

  const tripId = trip.id;

  const handleSimulatePostback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferId || isSimulating) return;

    setIsSimulating(true);
    const offer = offers.find(o => o.id === selectedOfferId);
    if (!offer) return;

    // sub_id format = tripId.offerId.memberId
    const subId = `${tripId}.${offer.id}.guest`;

    try {
      const res = await fetch(`/api/partners/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner: offer.partner,
          subId,
          amount: parseFloat(bookingAmount),
          commission: parseFloat(commissionAmount)
        })
      });

      if (!res.ok) throw new Error('Simulation failed');

      // Sync and reload states
      const syncRes = await fetch(`/api/trip/${tripId}/sync`);
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        
        // Refresh metrics view
        const metricsRes = await fetch(`/api/trip/${tripId}/sync`); // we'll fetch from sync endpoint
        // Wait, instead of fetching from sync, let's just reload the page details or trigger router.refresh()!
        router.refresh();
        
        // Wait 500ms then reload local data by calling sync manually to avoid full reload delay
        setTimeout(async () => {
          const mRes = await fetch(`/api/trip/${tripId}/sync`);
          if (mRes.ok) {
            const data = await mRes.json();
            // Fetch metrics again using server action or route. Since we are in client, let's call a quick client-side metrics route!
            // Wait! Do we have a client metrics endpoint? We don't have a route.ts under /api/trip/[tripId]/metrics. 
            // We can reload the window to update the RSC, which is extremely simple and works perfectly!
            window.location.reload();
          }
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
      alert('Simulation failed: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const netMarginColor = metrics.netMargin >= 0 ? 'text-[#1f4d3f]' : 'text-[#C2592F]';
  const netMarginBg = metrics.netMargin >= 0 ? 'bg-[#1f4d3f]/5' : 'bg-[#C2592F]/5';

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-12 z-10">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/trip/${tripId}/plan`} className="text-ink-text hover:text-secondary transition">
            <ArrowLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Economics</h1>
            <p className="font-body-sm text-muted-text">Trip Unit Economics & conversion rates</p>
          </div>
        </div>

        {/* METRICS DASHBOARD GRID */}
        <div className="grid grid-cols-1 gap-4">
          
          {/* Main Net Margin Card */}
          <div className={`p-5 rounded-2xl border border-border-warm-grey/80 shadow-xs space-y-2 ${netMarginBg}`}>
            <span className="font-label-caps text-[10px] text-muted-text font-bold">NET TRIP MARGIN</span>
            <div className={`font-mono text-3xl font-extrabold ${netMarginColor}`}>
              ₹{metrics.netMargin}
            </div>
            <p className="font-body-sm text-xs text-muted-text">
              Total Affiliate/Upgrade earnings minus API token costs
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Total Revenue */}
            <div className="bg-card-cream border border-border-warm-grey/60 p-4 rounded-xl shadow-xs space-y-1">
              <div className="flex items-center gap-1.5 text-muted-text text-[10px] font-label-caps font-bold">
                <TrendingUp className="w-3.5 h-3.5 text-[#1f4d3f]" /> Revenue
              </div>
              <div className="font-mono text-base font-bold text-[#1f4d3f]">
                ₹{metrics.totalRevenue}
              </div>
              <div className="text-[9px] text-muted-text font-body-sm">
                Upgrades: ₹{metrics.upgradeRevenue} <br />
                Commissions: ₹{metrics.affiliateRevenue}
              </div>
            </div>

            {/* Total AI Cost */}
            <div className="bg-card-cream border border-border-warm-grey/60 p-4 rounded-xl shadow-xs space-y-1">
              <div className="flex items-center gap-1.5 text-muted-text text-[10px] font-label-caps font-bold">
                <Cpu className="w-3.5 h-3.5 text-[#C2592F]" /> AI Costs
              </div>
              <div className="font-mono text-base font-bold text-[#C2592F]">
                ₹{metrics.totalAiCost}
              </div>
              <div className="text-[9px] text-muted-text font-body-sm">
                Total LLM calls: {metrics.totalAiCalls} <br />
                Based on Flash usage
              </div>
            </div>
          </div>
        </div>

        {/* FUNNEL CARD */}
        <div className="bg-card-cream border border-border-warm-grey/80 p-5 rounded-2xl shadow-xs space-y-4">
          <h2 className="font-label-caps text-xs text-muted-text tracking-wider font-bold">OFFERS CONVERSION FUNNEL</h2>
          
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-text font-body-sm">Offers Surfaced</span>
              <span className="font-mono font-bold text-ink-text">{metrics.offersShown}</span>
            </div>
            
            <div className="relative h-1.5 bg-[#fff9ed] rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-secondary" style={{ width: `${Math.min(100, metrics.offersShown > 0 ? (metrics.offersClicked / metrics.offersShown) * 100 : 0)}%` }} />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-text font-body-sm">Affiliate Clicks</span>
              <span className="font-mono font-bold text-ink-text">{metrics.offersClicked}</span>
            </div>

            <div className="relative h-1.5 bg-[#fff9ed] rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-[#1f4d3f]" style={{ width: `${Math.min(100, metrics.offersClicked > 0 ? (metrics.offersConverted / metrics.offersClicked) * 100 : 0)}%` }} />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-text font-body-sm">Conversions</span>
              <span className="font-mono font-bold text-[#1f4d3f]">{metrics.offersConverted}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-warm-grey/50">
            <div className="text-center">
              <div className="text-[10px] font-label-caps text-muted-text font-bold">CLICK RATIO</div>
              <div className="font-mono text-sm font-bold text-secondary">{metrics.clickRatio}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-label-caps text-muted-text font-bold">CONV. RATIO</div>
              <div className="font-mono text-sm font-bold text-[#1f4d3f]">{metrics.conversionRatio}%</div>
            </div>
          </div>
        </div>

        {/* WEBHOOK SIMULATOR WIDGET */}
        <div className="bg-card-cream border border-border-warm-grey/80 p-5 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-label-caps text-xs text-muted-text tracking-wider font-bold">PARTNER WEBHOOK POSTBACK SIMULATOR</h2>
          </div>

          {offers.length === 0 ? (
            <p className="text-xs font-body-sm text-muted-text italic">
              Create decisions (hotel) or upload flight vouchers to surface affiliate offers first.
            </p>
          ) : (
            <form onSubmit={handleSimulatePostback} className="space-y-3.5 text-left text-xs">
              <div className="space-y-1">
                <label className="block font-label-caps text-muted-text text-[9px] font-bold">SELECT ACTIVE OFFER</label>
                <select
                  value={selectedOfferId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedOfferId(id);
                    // Autofill commission based on partner estimates
                    const off = offers.find(o => o.id === id);
                    if (off) {
                      setCommissionAmount(String(off.commission_estimate));
                      setBookingAmount(String(off.price));
                    }
                  }}
                  className="w-full bg-[#fff9ed] border border-border-warm-grey/60 text-ink-text font-body-md rounded-xl p-2.5 outline-none"
                >
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      [{o.partner}] {o.title.substring(0, 30)}... (₹{o.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block font-label-caps text-muted-text text-[9px] font-bold">BOOKING AMOUNT (INR)</label>
                  <input
                    type="number"
                    value={bookingAmount}
                    onChange={(e) => setBookingAmount(e.target.value)}
                    required
                    className="w-full bg-[#fff9ed] border border-border-warm-grey/60 text-ink-text font-mono rounded-xl p-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-label-caps text-muted-text text-[9px] font-bold">COMMISSION PAID (INR)</label>
                  <input
                    type="number"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    required
                    className="w-full bg-[#fff9ed] border border-border-warm-grey/60 text-ink-text font-mono rounded-xl p-2 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSimulating}
                className="w-full bg-secondary hover:bg-red-800 text-surface font-body-sm font-semibold py-2 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                {isSimulating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Simulate Partner Postback
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
