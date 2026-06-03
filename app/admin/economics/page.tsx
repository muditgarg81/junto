import React from 'react';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getTripMetrics } from '@/lib/metrics';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import MetricsClient from '@/app/trip/[tripId]/metrics/MetricsClient';
import { ArrowLeft, BarChart2 } from 'lucide-react';

export default async function AdminEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  // Gate check: Only app operator (default-mudit-garg) can access system economics
  const user = await getCurrentUser();
  if (!user || user.auth_id !== 'default-mudit-garg') {
    notFound();
  }

  const { tripId } = await searchParams;

  if (tripId) {
    // Render detailed economics for a single trip
    const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripRes.rows.length === 0) {
      notFound();
    }
    const trip = tripRes.rows[0];
    const metrics = await getTripMetrics(tripId);
    const offersRes = await query(
      "SELECT * FROM offers WHERE trip_id = $1 ORDER BY created_at DESC LIMIT 5",
      [tripId]
    );
    const activeOffers = offersRes.rows;

    return (
      <div className="relative min-h-screen bg-surface">
        {/* Admin Bar back link to all trip economics */}
        <div className="bg-[#1f4d3f] text-surface-container-lowest py-3 px-6 max-w-md mx-auto flex items-center gap-2 text-xs font-semibold">
          <Link href="/admin/economics" className="hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Operator Console
          </Link>
        </div>
        <MetricsClient
          trip={trip}
          metrics={metrics}
          offers={activeOffers}
        />
      </div>
    );
  }

  // Otherwise, list all trips and their unit economics summary
  const tripsRes = await query('SELECT * FROM trips ORDER BY created_at DESC');
  const trips = tripsRes.rows;

  const tripsWithMetrics = await Promise.all(
    trips.map(async (trip) => {
      const metrics = await getTripMetrics(trip.id);
      return {
        ...trip,
        metrics,
      };
    })
  );

  return (
    <div className="relative min-h-screen bg-surface px-6 py-8 max-w-md mx-auto border-x border-border-warm-grey shadow-sm">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-text leading-tight flex items-center gap-2">
            <BarChart2 className="w-8 h-8 text-[#1f4d3f]" />
            Junto Operator
          </h1>
          <p className="font-body-sm text-muted-text mt-1">System Unit Economics & Analytics Panel</p>
        </div>

        <div className="space-y-4">
          <h2 className="font-label-caps text-xs text-muted-text tracking-wider">All Trips Economics</h2>
          
          {tripsWithMetrics.length === 0 ? (
            <div className="bg-card-cream border border-border-warm-grey p-6 rounded-2xl text-center text-muted-text">
              No trips registered in the system.
            </div>
          ) : (
            <div className="space-y-3">
              {tripsWithMetrics.map((trip) => {
                const margin = trip.metrics.netMargin;
                return (
                  <Link
                    key={trip.id}
                    href={`/admin/economics?tripId=${trip.id}`}
                    className="block bg-card-cream border border-border-warm-grey hover:border-outline-variant p-4 rounded-xl shadow-xs transition active:scale-[0.99] duration-150 text-left"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-headline-sm text-sm text-ink-text font-bold truncate pr-2">
                        {trip.name}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        margin >= 0 ? 'bg-ai-sage-tint text-[#1f4d3f]' : 'bg-[#ffdad6] text-[#ba1a1a]'
                      }`}>
                        Margin: ₹{margin.toFixed(0)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border-warm-grey/40 text-center">
                      <div>
                        <span className="block text-[8px] font-label-caps text-muted-text uppercase">Revenue</span>
                        <span className="text-xs font-semibold text-ink-text">₹{trip.metrics.totalRevenue.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-label-caps text-muted-text uppercase">AI Cost</span>
                        <span className="text-xs font-semibold text-secondary">₹{trip.metrics.totalAiCost.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-label-caps text-muted-text uppercase">Funnel</span>
                        <span className="text-xs font-semibold text-ink-text">{trip.metrics.offersConverted}/{trip.metrics.offersClicked} conv</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <footer className="mt-12 text-center text-[10px] text-muted-text uppercase tracking-widest font-label-caps">
        Junto Internal Operator Tool
      </footer>
    </div>
  );
}
