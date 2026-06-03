'use strict';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm text-left">
      <div className="flex-grow px-6 py-8 space-y-6 pb-24 z-10">
        
        {/* Header App Bar */}
        <div className="flex items-center gap-3 border-b border-border-warm-grey pb-4">
          <Link href="/onboarding" className="text-ink-text hover:text-secondary transition">
            <ArrowLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-ink-text font-bold">Terms & Conditions</h1>
            <p className="font-body-sm text-[11px] text-muted-text">Effective June 3, 2026</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 font-body-sm text-xs text-ink-text leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">1. Acceptance of Terms</h2>
            <p>
              By creating a traveler profile on Junto, you agree to comply with and be bound by these Terms & Conditions. If you do not agree, please do not use the application.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">2. Group Collaboration</h2>
            <p>
              Junto is a cooperative travel planning tool. Any information, including suggestions, proposed dates, and ledger expenses you input into a trip workspace will be visible to all members you invite or authorize to join that trip.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">3. Settlement Ledger</h2>
            <p>
              The settlement balances computed by Junto are reference estimations based on user expense inputs. Junto does not process financial transfers directly. You are solely responsible for verifying the accuracy of ledger balances before settling debts externally via UPI or third-party gateways.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">4. Code of Conduct</h2>
            <p>
              You agree to use Junto only for lawful purposes. You must not upload offensive files, transmit spam, or attempt to breach database security controls.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">5. Service Availability</h2>
            <p>
              Junto provides travel orchestration services on an "as is" and "as available" basis. We reserve the right to modify, suspend, or terminate the application or any features at any time without notice.
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
