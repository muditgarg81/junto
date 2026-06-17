'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
// Inline SVG Icons to prevent lucide-react bundling/hydration issues on WebView
function Mail({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.99 5.74a2 2 0 0 1-2.01 0L2 7" />
    </svg>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

import { passwordSigninAction } from './actions';

interface SignInFormProps {
  redirectPath: string;
}

export default function SignInForm({ redirectPath }: SignInFormProps) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle Real Google Sign In Redirect
  // On Capacitor (Android): use @capacitor/browser (Custom Chrome Tab) so the
  // OAuth cookie is written into the shared Android cookie store that the WebView
  // also reads.  On web: normal navigation.
  const handleGoogleSignIn = async () => {
    setLoading(true);
    const oauthUrl = `https://junto-three.vercel.app/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`;

    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');

        const listener = await Browser.addListener('browserPageLoaded', async () => {
          await listener.remove();
          await Browser.close();
          router.refresh();
          setLoading(false);
        });

        await Browser.open({ url: oauthUrl, presentationStyle: 'popover' });
        return; // stay in loading state — listener will clear it
      }
    } catch {
      // Plugin unavailable or not synced — fall through to web redirect
      setLoading(false);
    }

    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`;
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) return;
    setAuthError('');
    setLoading(true);
    try {
      const res = await passwordSigninAction(emailInput, passwordInput, redirectPath);
      if (res.success && res.redirectTo) {
        // Hard navigation so the browser re-reads the freshly-set session cookie
        window.location.href = res.redirectTo;
        return;
      }
      if (!res.success) {
        setAuthError(res.error ?? 'Sign-in failed.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError('Something went wrong. Please try again.');
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
          
          {loading && (
            <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin text-[#1f4d3f]" />
              <p className="font-body-sm text-muted-text">Connecting secure session...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Google Button */}
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-[#1f4d3f] hover:bg-[#15342a] text-surface font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition duration-200 cursor-pointer"
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

              {/* Email + Password Form */}
              <form onSubmit={handleEmailPasswordSubmit} className="space-y-3 text-left">
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-md pl-11 pr-4 py-3.5 rounded-xl outline-none transition duration-150"
                  />
                  <Mail className="w-5 h-5 text-muted-text/60 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-md pl-11 pr-4 py-3.5 rounded-xl outline-none transition duration-150"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted-text/60 absolute left-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                {authError && (
                  <p className="text-[11px] text-red-500 px-1">{authError}</p>
                )}
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 border border-outline-variant hover:border-outline text-ink-text font-body-md font-semibold py-4 px-6 rounded-xl hover:bg-surface-container-low transition duration-200 cursor-pointer"
                >
                  Sign in / Create account
                </button>
                <p className="text-[10px] text-muted-text/70 text-center px-2">
                  New here? Enter your email + a new password to create an account.
                </p>
              </form>

              {/* Invite Helper Link */}
              <p className="text-[11px] font-body-sm text-muted-text pt-2">
                Joining a trip? <span className="font-semibold text-secondary">Just open your invite link.</span>
              </p>
            </>
          )}

        </div>
      </main>

      {/* Footer Text */}
      <footer className="max-w-md w-full mx-auto text-center mt-6 z-10">
        <p className="font-body-sm text-[11px] text-muted-text">
          We&apos;ll set up your traveler profile right after you sign in.
        </p>
      </footer>

    </div>
  );
}
