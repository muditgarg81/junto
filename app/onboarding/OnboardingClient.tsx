'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { Sparkles, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

interface OnboardingClientProps {
  initialEmail: string;
  initialName: string;
  redirect: string;
}

function OnboardingForm({ initialEmail, initialName, redirect }: OnboardingClientProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [photoUrl, setPhotoUrl] = useState('');
  const [upiId, setUpiId] = useState('');
  const [homeCurrency, setHomeCurrency] = useState('INR');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy || !acceptedDisclaimer) {
      setError('You must accept the terms, privacy policy, and disclaimer to proceed.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          photoUrl: photoUrl.trim() || null,
          upiId: upiId.trim() || null,
          homeCurrency
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      // Success - redirect to the target URL
      router.push(redirect);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-surface overflow-hidden px-6 py-8 max-w-md mx-auto border-x border-border-warm-grey shadow-sm">
      
      {/* Back Chevron to Sign-in page */}
      <div className="absolute top-6 left-6 z-25">
        <Link 
          href="/signin" 
          className="p-2 rounded-full border border-border-warm-grey bg-card-cream hover:bg-surface-container text-ink-text transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs flex items-center justify-center cursor-pointer"
          title="Back to Sign-in"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      {/* Background Gradient Washes */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#ffdbcf] rounded-full blur-[120px] opacity-40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-ai-sage-tint rounded-full blur-[120px] opacity-50 pointer-events-none" />

      {/* Header */}
      <div className="text-center mt-6 z-10 space-y-2">
        <div className="inline-flex p-2 bg-[#ffdbcf] text-[#802901] rounded-2xl shadow-xs animate-pulse">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="font-display text-4xl text-ink-text tracking-tight font-bold">
          Create Profile
        </h1>
        <p className="font-body-sm text-muted-text max-w-xs mx-auto">
          Welcome to {APP_NAME}. Let&apos;s set up your traveler identity.
        </p>
      </div>

      {/* Onboarding Form */}
      <main className="flex-grow flex flex-col justify-center py-6 z-10">
        <form onSubmit={handleSubmit} className="space-y-5 bg-card-cream border border-border-warm-grey rounded-2xl p-6 shadow-xs">
          
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="block font-label-caps text-[10px] text-muted-text font-bold uppercase tracking-wider px-1">
              Your Name <span className="text-secondary">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mudit Garg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition duration-150"
            />
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block font-label-caps text-[10px] text-muted-text font-bold uppercase tracking-wider px-1">
              Email Address <span className="text-secondary">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.g. muditgarg81@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition duration-150"
            />
          </div>

          {/* Profile Photo URL Field */}
          <div className="space-y-1.5">
            <label className="block font-label-caps text-[10px] text-muted-text font-bold uppercase tracking-wider px-1 flex justify-between">
              <span>Profile Image URL</span>
              <span className="text-[9px] lowercase font-normal italic text-muted-text/70">(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full bg-surface border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition duration-150"
            />
          </div>

          {/* UPI ID Field */}
          <div className="space-y-1.5">
            <label className="block font-label-caps text-[10px] text-muted-text font-bold uppercase tracking-wider px-1 flex justify-between">
              <span>UPI ID for Settlements</span>
              <span className="text-[9px] lowercase font-normal italic text-muted-text/70">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. mudit@okhdfc"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full bg-surface border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition duration-150"
            />
          </div>

          {/* Home Currency Dropdown */}
          <div className="space-y-1.5">
            <label className="block font-label-caps text-[10px] text-muted-text font-bold uppercase tracking-wider px-1">
              Home Currency
            </label>
            <select
              value={homeCurrency}
              onChange={(e) => setHomeCurrency(e.target.value)}
              className="w-full bg-surface border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition duration-150 cursor-pointer"
            >
              <option value="INR">₹ INR (Indian Rupee)</option>
              <option value="USD">$ USD (US Dollar)</option>
              <option value="EUR">€ EUR (Euro)</option>
              <option value="GBP">£ GBP (British Pound)</option>
            </select>
          </div>
          
          {/* Terms, Privacy & Disclaimer checkboxes */}
          <div className="space-y-3 pt-2.5 border-t border-border-warm-grey/40 text-left">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="terms"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 rounded border-border-warm-grey text-primary focus:ring-primary shrink-0 mt-0.5 cursor-pointer"
              />
              <label htmlFor="terms" className="font-body-sm text-xs text-ink-text leading-relaxed select-none cursor-pointer">
                I accept the <Link href="/terms" target="_blank" className="text-primary hover:underline font-semibold">Terms & Conditions</Link> <span className="text-secondary">*</span>
              </label>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="privacy"
                required
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="w-4 h-4 rounded border-border-warm-grey text-primary focus:ring-primary shrink-0 mt-0.5 cursor-pointer"
              />
              <label htmlFor="privacy" className="font-body-sm text-xs text-ink-text leading-relaxed select-none cursor-pointer">
                I agree to the <Link href="/privacy" target="_blank" className="text-primary hover:underline font-semibold">Privacy Policy</Link> <span className="text-secondary">*</span>
              </label>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="disclaimer"
                required
                checked={acceptedDisclaimer}
                onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                className="w-4 h-4 rounded border-border-warm-grey text-primary focus:ring-primary shrink-0 mt-0.5 cursor-pointer"
              />
              <label htmlFor="disclaimer" className="font-body-sm text-xs text-ink-text leading-relaxed select-none cursor-pointer">
                I acknowledge the <Link href="/disclaimer" target="_blank" className="text-primary hover:underline font-semibold">Disclaimer</Link> that Junto is a planning utility and assumes no liability for itinerary connections or actual expenses <span className="text-secondary">*</span>
              </label>
            </div>
          </div>

          {error && <p className="text-secondary text-xs px-1 font-medium">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary-container hover:bg-primary disabled:bg-primary-container/70 text-surface-container-lowest font-body-md font-semibold py-3.5 px-6 rounded-xl shadow-sm hover:shadow active:scale-[0.98] transition-all duration-200 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Complete setup
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center mt-4 z-10">
        <p className="font-body-sm text-[11px] text-muted-text">
          By continuing, you agree to setup local traveler profile storage.
        </p>
      </footer>
    </div>
  );
}

export default function OnboardingClient({ initialEmail, initialName, redirect }: OnboardingClientProps) {
  return (
    <OnboardingForm initialEmail={initialEmail} initialName={initialName} redirect={redirect} />
  );
}
