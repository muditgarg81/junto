'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { Navigation, ArrowRight, User } from 'lucide-react';
import { User as UserType } from '@/lib/types';

interface WelcomeClientProps {
  user: UserType | null;
}

export default function WelcomeClient({ user }: WelcomeClientProps) {
  const router = useRouter();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) return;

    let token = inviteToken.trim();
    if (token.includes('/join/')) {
      const parts = token.split('/join/');
      token = parts[parts.length - 1];
    }

    token = token.replace(/[^a-zA-Z0-9-_]/g, '');

    if (token) {
      router.push(`/join/${token}`);
    } else {
      setError('Invalid invite link or token format.');
    }
  };

  // Avatar content: user image, user initial, or fallback 'N'
  const renderAvatarContent = () => {
    if (user && user.photo_url) {
      return (
        <img
          src={user.photo_url}
          alt={user.name}
          className="w-full h-full object-cover rounded-full"
        />
      );
    }
    if (user && user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return 'N';
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-surface overflow-hidden px-6 py-8 max-w-md mx-auto border-x border-border-warm-grey shadow-sm">
      {/* Floating profile avatar linked to `/profile` */}
      <Link
        href="/profile"
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-primary-container hover:bg-primary text-surface-container-lowest flex items-center justify-center font-display font-semibold shadow-md active:scale-95 transition-all duration-200 z-50 overflow-hidden"
        title="View Profile"
        id="welcome-profile-avatar"
      >
        {renderAvatarContent()}
      </Link>

      {/* Background Gradient Washes */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#ffdbcf] rounded-full blur-[120px] opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-ai-sage-tint rounded-full blur-[120px] opacity-65 pointer-events-none" />

      {/* Decorative SVG Travel Line */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M -50 150 C 150 180, 250 80, 450 120"
          fill="none"
          stroke="#a04018"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        <path
          d="M -10 500 C 100 450, 200 600, 420 520"
          fill="none"
          stroke="#1f4d3f"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
      </svg>

      {/* Top Spacer */}
      <div className="h-4" />

      {/* Main Content */}
      <div className="max-w-md w-full mx-auto flex flex-col items-center justify-center flex-grow text-center z-10">
        {/* Logo */}
        <h1 className="font-display text-5xl md:text-6xl text-ink-text select-none tracking-tight mb-2">
          {APP_NAME}
          <span className="text-secondary">.</span>
        </h1>

        {/* Tagline */}
        <p className="font-body-lg text-muted-text max-w-xs mb-12">
          {APP_TAGLINE}
        </p>

        {/* Buttons / Actions Container */}
        <div className="w-full space-y-4 px-4">
          {!showJoinInput ? (
            <>
              {/* Start a Trip Button */}
              <Link
                href="/create-trip"
                className="w-full flex items-center justify-center gap-2 bg-primary-container hover:bg-primary text-surface-container-lowest font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm transition duration-200"
              >
                <Navigation className="w-4 h-4 rotate-45" />
                Start a trip
              </Link>

              {/* Join with a Link Button */}
              <button
                onClick={() => setShowJoinInput(true)}
                className="w-full flex items-center justify-center gap-2 border border-outline-variant hover:border-outline text-ink-text font-body-md font-medium py-4 px-6 rounded-xl hover:bg-surface-container-low transition duration-200"
              >
                Join with a link
              </button>
            </>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-3 text-left">
              <label className="block font-label-caps text-muted-text px-1">
                Enter Invite Link or Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Invite link or token..."
                  value={inviteToken}
                  onChange={(e) => {
                    setInviteToken(e.target.value);
                    setError('');
                  }}
                  className="flex-grow bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition duration-200"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-primary-container hover:bg-primary text-surface-container-lowest p-3 rounded-xl shadow-sm transition duration-200"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              {error && <p className="text-secondary text-xs px-1">{error}</p>}
              <button
                type="button"
                onClick={() => {
                  setShowJoinInput(false);
                  setError('');
                }}
                className="font-body-sm text-muted-text hover:text-ink-text underline px-1 mt-1 block"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center mt-8 z-10">
        <p className="font-body-sm text-muted-text">
          No app needed for friends you invite.
        </p>
      </div>
    </div>
  );
}
