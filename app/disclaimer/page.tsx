'use strict';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm text-left">
      <div className="flex-grow px-6 py-8 space-y-6 pb-24 z-10">
        
        {/* Header App Bar */}
        <div className="flex items-center gap-3 border-b border-border-warm-grey pb-4">
          <Link href="/onboarding" className="text-ink-text hover:text-secondary transition">
            <ArrowLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-ink-text font-bold">Disclaimer</h1>
            <p className="font-body-sm text-[11px] text-muted-text">Effective June 3, 2026</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 font-body-sm text-xs text-ink-text leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">Planning Utility Only</h2>
            <p>
              Junto is a collaborative trip scoping utility designed to help friends coordinate itineraries, budget plans, and task lists. Junto is not a travel agency, booking merchant, or financial services provider.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">Booking & Travel Risks</h2>
            <p>
              Junto does not make bookings on your behalf or process payments. All flight connections, stays, and activities are suggestions or user-uploaded records. You are solely responsible for ensuring booking confirmations are valid and flights do not conflict with visa or transfer timelines.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">Mock Operations</h2>
            <p>
              Certain payment integrations, checkout interfaces, and simulated offers inside Junto are for demonstration and budgeting purposes only. Verify all external transactions manually.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">No Liability</h2>
            <p>
              In no event shall Junto or its developers be liable for any missed flights, hotel cancellations, ledger disputes, or general travel disruptions occurring during trips planned using this application.
            </p>
          </section>
        </div>
      </div>

      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <Link href="/onboarding" className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold">
          ← Back to Signup
        </Link>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Agreement Hub</span>
      </footer>
    </div>
  );
}
