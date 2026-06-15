'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { Sparkles, Loader2, Mail } from 'lucide-react';
import { signinAction } from './actions';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/home';

  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Handle Mock Google Sign In
  const handleGoogleSignIn = async (authId: string, email: string, name: string) => {
    setLoading(true);
    setShowGoogleModal(false);
    try {
      const res = await signinAction(authId, email, name);
      if (res.success) {
        if (res.hasProfile) {
          router.push(redirectPath);
        } else {
          // New user, send to onboarding with redirect path preserved
          const onboardingUrl = `/onboarding?redirect=${encodeURIComponent(redirectPath)}`;
          router.push(onboardingUrl);
        }
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Mock Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Mock Magic Link Sign In
  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    try {
      // Create a mock authId from the email
      const cleanEmail = emailInput.trim().toLowerCase();
      const mockAuthId = `email-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
      
      // Determine a friendly mock name
      const mockName = cleanEmail.split('@')[0];
      const displayName = mockName.charAt(0).toUpperCase() + mockName.slice(1);

      const res = await signinAction(mockAuthId, cleanEmail, displayName);
      
      setMagicLinkSent(true);
      
      // Auto-simulate clicking the magic link after 1.2 seconds
      setTimeout(() => {
        if (res.success) {
          if (res.hasProfile) {
            router.push(redirectPath);
          } else {
            const onboardingUrl = `/onboarding?redirect=${encodeURIComponent(redirectPath)}`;
            router.push(onboardingUrl);
          }
          router.refresh();
        }
      }, 1200);

    } catch (err) {
      console.error(err);
      alert('Failed to send mock sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-surface overflow-hidden px-6 py-8 max-w-md mx-auto border-x border-border-warm-grey shadow-sm">
      
      {/* Background Gradient Washes */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#ffdbcf] rounded-full blur-[120px] opacity-40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-ai-sage-tint rounded-full blur-[120px] opacity-50 pointer-events-none" />

      {/* Top Spacer */}
      <div className="h-4" />

      {/* Main Content */}
      <main className="max-w-md w-full mx-auto flex flex-col items-center justify-center flex-grow text-center z-10 space-y-10">
        
        {/* Header Wordmark */}
        <div className="space-y-3">
          <h1 className="font-display text-5xl md:text-6xl text-ink-text select-none tracking-tight font-bold">
            {APP_NAME}
            <span className="text-secondary">.</span>
          </h1>
          <p className="font-body-lg text-muted-text max-w-xs mx-auto">
            {APP_TAGLINE}
          </p>
        </div>

        {/* Auth Forms Container */}
        <div className="w-full space-y-4 px-2">
          
          {loading && !showGoogleModal && !magicLinkSent && (
            <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin text-[#1f4d3f]" />
              <p className="font-body-sm text-muted-text">Connecting secure session...</p>
            </div>
          )}

          {magicLinkSent && (
            <div className="bg-ai-sage-tint/40 border border-[#1f4d3f]/20 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin text-[#1f4d3f]" />
              <p className="font-body-sm text-ink-text font-semibold">Sign-in link sent!</p>
              <p className="font-body-sm text-muted-text text-[11px]">Simulating magic link verification click...</p>
            </div>
          )}

          {!loading && !magicLinkSent && (
            <>
              {/* Google Button */}
              <button
                onClick={() => setShowGoogleModal(true)}
                className="w-full flex items-center justify-center gap-3 bg-[#1f4d3f] hover:bg-[#15342a] text-surface font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition duration-200"
              >
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.56-1.56 2.95-3.24 3.75v3.02h5.18c3.07-2.83 4.84-7 4.84-11.91 0-.62-.06-1.22-.16-1.59zM12.18 21c3.24 0 5.97-1.07 7.96-2.91l-5.18-3.02c-.77.52-1.77.83-2.78.83-2.14 0-3.96-1.43-4.61-3.37H2.23v3.13C4.19 18.66 7.93 21 12.18 21zM7.57 12.53a5.4 5.4 0 010-3.06V6.34H2.23a9.99 9.99 0 000 9.32l5.34-3.13zM12.18 5.92c1.77 0 3.35.61 4.6 1.8l3.43-3.43C18.15 2.37 15.42 1.5 12.18 1.5 7.93 1.5 4.19 3.84 2.23 7.97l5.34 3.13c.65-1.94 2.47-3.37 4.61-3.37z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 py-2">
                <div className="flex-grow border-t border-border-warm-grey" />
                <span className="text-[10px] font-label-caps text-muted-text/70 tracking-widest">OR</span>
                <div className="flex-grow border-t border-border-warm-grey" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleMagicLinkSubmit} className="space-y-3 text-left">
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address..."
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-md pl-11 pr-4 py-3.5 rounded-xl outline-none transition duration-150"
                  />
                  <Mail className="w-5 h-5 text-muted-text/60 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 border border-outline-variant hover:border-outline text-ink-text font-body-md font-semibold py-4 px-6 rounded-xl hover:bg-surface-container-low transition duration-200 cursor-pointer"
                >
                  Email me a sign-in link
                </button>
              </form>

              {/* Invite Helper Link */}
              <p className="text-[11px] font-body-sm text-muted-text pt-2">
                Joining a trip? <span className="font-semibold text-secondary">Just open your invite link.</span>
              </p>
            </>
          )}

        </div>
      </main>

      {/* Google Mock Account Modal Selector */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-ink-text/30 backdrop-blur-xs flex items-center justify-center z-50 p-6">
          <div className="bg-surface max-w-sm w-full rounded-2xl border border-border-warm-grey shadow-lg p-6 space-y-5 text-left animate-fade-in">
            <div>
              <h3 className="font-headline-sm text-ink-text font-bold">Sign in with Google</h3>
              <p className="text-xs text-muted-text font-body-sm mt-0.5">Choose an account to continue to Junto</p>
            </div>
            
            <div className="space-y-2.5">
              {/* Account 1: Seeded user Mudit Garg */}
              <button
                onClick={() => handleGoogleSignIn('default-mudit-garg', 'muditgarg81@gmail.com', 'Mudit Garg')}
                className="w-full flex items-center gap-3 p-3 bg-card-cream hover:bg-surface-container-low border border-border-warm-grey rounded-xl text-left transition"
              >
                <div className="w-8 h-8 rounded-full bg-[#1f4d3f] text-surface flex items-center justify-center font-bold text-sm shrink-0">
                  M
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-text truncate">Mudit Garg</span>
                  <span className="block text-[11px] text-muted-text truncate">muditgarg81@gmail.com</span>
                </div>
                <span className="ml-auto text-[9px] bg-primary-container/10 text-[#1f4d3f] border border-[#1f4d3f]/20 rounded-full px-1.5 py-0.2 shrink-0 font-bold">
                  has profile
                </span>
              </button>

              {/* Account 2: New Traveler */}
              <button
                onClick={() => handleGoogleSignIn('user-newtraveler', 'newtraveler@example.com', 'New Traveler')}
                className="w-full flex items-center gap-3 p-3 bg-card-cream hover:bg-surface-container-low border border-border-warm-grey rounded-xl text-left transition"
              >
                <div className="w-8 h-8 rounded-full bg-secondary text-surface flex items-center justify-center font-bold text-sm shrink-0">
                  N
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-text truncate">New Traveler</span>
                  <span className="block text-[11px] text-muted-text truncate">newtraveler@example.com</span>
                </div>
                <span className="ml-auto text-[9px] bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-1.5 py-0.2 shrink-0 font-bold">
                  no profile
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowGoogleModal(false)}
              className="w-full text-center text-xs font-semibold text-muted-text hover:text-ink-text py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer Text */}
      <footer className="max-w-md w-full mx-auto text-center mt-6 z-10">
        <p className="font-body-sm text-[11px] text-muted-text">
          We&apos;ll set up your traveler profile right after you sign in.
        </p>
      </footer>

    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface font-body-md text-muted-text">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p>Loading sign in...</p>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
