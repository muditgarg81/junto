'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

import { passwordSigninAction, passwordSignupAction } from './actions';

interface SignInFormProps {
  redirectPath: string;
}

export default function SignInForm({ redirectPath }: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams ? searchParams.get('error') : null;
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(urlError ? `Sign-in error: ${urlError}` : '');
  const [loading, setLoading] = useState(false);

  // Handle Real Google Sign In Redirect
  // On Capacitor (Android): use @capacitor/browser (Custom Chrome Tab) so the
  // OAuth cookie is written into the shared Android cookie store that the WebView
  // also reads.  On web: normal navigation.
  const handleGoogleSignIn = async () => {
    setLoading(true);

    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');

        // Generate a unique session nonce to distinguish the fresh callback from old launch intents
        const nonce = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('oauth_nonce', nonce);

        const redirectWithNonce = redirectPath.includes('?')
          ? `${redirectPath}&nonce=${nonce}`
          : `${redirectPath}?nonce=${nonce}`;

        // On native, we prefix the redirect target path with 'native:'
        // so the backend knows to trigger custom URL scheme redirection (juntofun://callback)
        const nativeRedirectPath = `native:${redirectWithNonce}`;
        const oauthUrl = `https://junto-three.vercel.app/api/auth/google?redirect=${encodeURIComponent(nativeRedirectPath)}`;

        const listener = await Browser.addListener('browserFinished', async () => {
          alert("debug: browserFinished triggered!");
          await listener.remove();
          setLoading(false);
          
          // Fallback: in case the deep link was blocked or they completed it and manually closed
          try {
            const checkAuth = await fetch('/api/user/me');
            if (checkAuth.ok) {
              const data = await checkAuth.json();
              if (data && data.id) {
                window.location.href = redirectPath || '/home';
                return;
              }
            }
          } catch (e) {
            console.error('Error checking auth on finish:', e);
          }
        });

        alert("debug: Opening Custom Tab with url:\n" + oauthUrl);
        await Browser.open({ url: oauthUrl, presentationStyle: 'popover' });
        return; // stay in loading state — listener or deep link will handle redirect
      }
    } catch (err) {
      console.error('Capacitor native signin exception:', err);
      setLoading(false);
    }

    // Web fallback
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`;
  };

  const handleSignIn = async () => {
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

  const handleSignUp = async () => {
    if (!emailInput.trim() || !passwordInput) return;
    setAuthError('');
    setLoading(true);
    try {
      const res = await passwordSignupAction(emailInput, passwordInput, redirectPath);
      if (res.success && res.redirectTo) {
        // Hard navigation so the browser re-reads the freshly-set session cookie
        window.location.href = res.redirectTo;
        return;
      }
      if (!res.success) {
        setAuthError(res.error ?? 'Registration failed.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSignIn();
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
                  className="w-full flex items-center justify-center gap-2 bg-[#1f4d3f] hover:bg-[#15342a] text-surface font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition duration-200 cursor-pointer"
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={handleSignUp}
                  className="w-full flex items-center justify-center gap-2 border border-outline-variant hover:border-outline text-ink-text font-body-md font-semibold py-4 px-6 rounded-xl hover:bg-surface-container-low transition duration-200 cursor-pointer"
                >
                  Create new account
                </button>

                <p className="text-[10px] text-muted-text/70 text-center px-2 pt-1">
                  Need an account? Enter your email and a password, then tap &quot;Create new account&quot;.
                </p>
              </form>

              {/* Invite Helper Link */}
              <p className="text-[11px] font-body-sm text-muted-text pt-2 text-center w-full">
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
