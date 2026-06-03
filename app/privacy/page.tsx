'use strict';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm text-left">
      <div className="flex-grow px-6 py-8 space-y-6 pb-24 z-10">
        
        {/* Header App Bar */}
        <div className="flex items-center gap-3 border-b border-border-warm-grey pb-4">
          <Link href="/onboarding" className="text-ink-text hover:text-secondary transition">
            <ArrowLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-ink-text font-bold">Privacy Policy</h1>
            <p className="font-body-sm text-[11px] text-muted-text">Effective June 3, 2026</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 font-body-sm text-xs text-ink-text leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">1. Information We Collect</h2>
            <p>
              When you onboard on Junto, we collect your profile name, email address, optional profile image URL, and optional UPI ID. When collaborating, we collect your message content, checklist items, budget entries, and uploaded voucher documents.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">2. How We Use Information</h2>
            <p>
              Your profile information is used to authorize access to trips, attribute checklist items, and allocate expense balances in shared ledgers. We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">3. Document Uploads & OCR</h2>
            <p>
              Any travel vouchers or receipts you upload to the Document Vault are temporarily parsed using AI vision APIs to pre-fill itinerary details. These uploads are private to your authorized group trip roster.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">4. Data Sharing & Security</h2>
            <p>
              Information is shared only with other authenticated members of trips you join. We apply industry-standard security protocols to protect your profile details, vouchers, and transactions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-sm text-primary uppercase tracking-wider">5. Your Choices & Deletion</h2>
            <p>
              You can export or delete your traveler profile data from the account settings tab at any time. Tripping members can delete items they created from check lists and document vaults.
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
