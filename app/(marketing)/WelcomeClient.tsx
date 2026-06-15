'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navigation, ArrowRight, Users, Brain, Wallet, MapPin, Star, CheckCircle } from 'lucide-react';
import { User as UserType } from '@/lib/types';

interface WelcomeClientProps {
  user: UserType | null;
}

export default function WelcomeClient({ user }: WelcomeClientProps) {
  const router = useRouter();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');

  // Redirect logged-in users to their dashboard
  React.useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) router.replace('/home'); })
      .catch(() => {});
  }, [router]);

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

  return (
    <div className="min-h-screen bg-surface text-ink-text">

      {/* ── NAV ── */}
      <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-display text-2xl font-bold tracking-tight">
          Junto<span className="text-secondary">.</span>
        </span>
        <Link
          href="/signin"
          className="font-body-sm text-sm font-medium text-muted-text hover:text-ink-text transition"
        >
          Sign in →
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
        {/* pill */}
        <span className="inline-flex items-center gap-1.5 bg-ai-sage-tint border border-[#1f4d3f]/20 text-[#1f4d3f] text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <Star className="w-3 h-3" /> AI-powered group travel · India-first
        </span>

        <h1 className="font-display text-5xl md:text-6xl font-bold text-ink-text leading-tight mb-4">
          One living plan<br />
          <span className="text-secondary">for the whole group.</span>
        </h1>

        <p className="font-body-lg text-muted-text text-lg max-w-xl mx-auto mb-10">
          Friends chat, Junto listens. It turns your messy WhatsApp threads into a shared itinerary, expense tracker, and booking hub — automatically updated as plans change.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          {!showJoinInput ? (
            <>
              <Link
                href="/create-trip"
                className="flex items-center gap-2 bg-primary-container hover:bg-primary text-surface font-body-md font-semibold py-3.5 px-7 rounded-xl shadow-sm transition text-base"
              >
                <Navigation className="w-4 h-4 rotate-45" />
                Start a trip — it&apos;s free
              </Link>
              <button
                onClick={() => setShowJoinInput(true)}
                className="flex items-center gap-2 border border-border-warm-grey hover:border-outline text-ink-text font-body-md font-medium py-3.5 px-7 rounded-xl hover:bg-surface-container-low transition text-base"
              >
                Join with a link
              </button>
            </>
          ) : (
            <form onSubmit={handleJoinSubmit} className="flex gap-2 w-full max-w-sm">
              <input
                type="text"
                placeholder="Invite link or token..."
                value={inviteToken}
                onChange={(e) => { setInviteToken(e.target.value); setError(''); }}
                className="flex-grow bg-card-cream border border-border-warm-grey focus:border-outline text-ink-text font-body-md px-4 py-3 rounded-xl outline-none transition"
                autoFocus
              />
              <button
                type="submit"
                className="bg-primary-container hover:bg-primary text-surface p-3 rounded-xl shadow-sm transition"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
        {error && <p className="text-secondary text-xs mt-2">{error}</p>}

        <p className="font-body-sm text-muted-text text-xs mt-4">
          No app install needed for friends you invite.
        </p>
      </section>

      {/* ── MOCKUP STRIP ── */}
      <section className="bg-card-cream border-y border-border-warm-grey py-10">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { emoji: '🗺️', stat: 'Live itinerary', sub: 'Updates as the group decides' },
            { emoji: '💸', stat: 'Expense splits', sub: 'Equal, exact, or by shares' },
            { emoji: '🤖', stat: 'AI concierge', sub: 'Surfaces what the group needs next' },
          ].map(({ emoji, stat, sub }) => (
            <div key={stat} className="bg-surface border border-border-warm-grey rounded-2xl p-5 shadow-xs">
              <div className="text-3xl mb-2">{emoji}</div>
              <div className="font-display font-bold text-ink-text text-base">{stat}</div>
              <div className="font-body-sm text-muted-text text-xs mt-1">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-14">

        <Feature
          icon={<Brain className="w-5 h-5 text-[#1f4d3f]" />}
          tag="AI Orchestrator"
          title="The AI plans with you, not for you."
          body="Junto reads your group chat and quietly turns emerging ideas into draft decisions — flights, hotels, activities. The group votes; the AI executes. It never locks anything without human approval."
          items={['Detects consensus from natural conversation', 'Creates draft proposals for the group to vote on', 'Keeps everyone in sync without status-update messages']}
        />

        <Feature
          icon={<MapPin className="w-5 h-5 text-[#1f4d3f]" />}
          tag="Living Itinerary"
          title="A timeline that builds itself."
          body="Upload a booking PDF and Junto reads it — flight times, hotel check-in, day-wise activity plans — and places everything on a shared timeline, date by date."
          items={['Reads flight, hotel, and activity PDFs via OCR', 'Day-wise itinerary auto-populates the timeline', 'Conflict detection flags tight connections and gaps']}
          reverse
        />

        <Feature
          icon={<Wallet className="w-5 h-5 text-[#1f4d3f]" />}
          tag="Smart Expenses"
          title="Split it once. Settle with one tap."
          body="Log expenses from chat or manually. Junto calculates who owes what and generates UPI deep-links so settling is one tap — no calculator, no awkward reminders."
          items={['Equal, share-weighted, or exact splits', 'UPI pay links for instant settlement', 'Full expense history and category breakdown']}
        />

        <Feature
          icon={<Users className="w-5 h-5 text-[#1f4d3f]" />}
          tag="Group-first"
          title="Built for how Indian groups actually travel."
          body="Junto is designed for 4–12 person trips — the kind where decisions happen over WhatsApp, someone always pays upfront, and half the group changes their mind twice. It handles all of that."
          items={['Invite friends via link — no app install required', 'Roles for organiser vs. member', 'Works on mobile, tablet, and desktop']}
          reverse
        />

      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="bg-ai-sage-tint border-y border-[#1f4d3f]/15 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-6 justify-center items-center text-[#1f4d3f] font-body-sm text-sm font-semibold">
          {['Free to use · always', 'No credit card required', 'India-first · UPI payments', 'Works on any device'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-text mb-4">
          Your next trip starts here.
        </h2>
        <p className="font-body-lg text-muted-text mb-8 max-w-md mx-auto">
          Free for groups of any size. No install needed for friends you invite.
        </p>
        <Link
          href="/create-trip"
          className="inline-flex items-center gap-2 bg-primary-container hover:bg-primary text-surface font-body-md font-semibold py-3.5 px-8 rounded-xl shadow-sm transition text-base"
        >
          <Navigation className="w-4 h-4 rotate-45" />
          Plan your trip free
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border-warm-grey py-6">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-text font-body-sm">
          <span>© 2026 Junto. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink-text transition">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-text transition">Terms</Link>
            <Link href="/disclaimer" className="hover:text-ink-text transition">Disclaimer</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ── Reusable feature section ── */
function Feature({
  icon, tag, title, body, items, reverse = false,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  body: string;
  items: string[];
  reverse?: boolean;
}) {
  return (
    <div className={`flex flex-col ${reverse ? 'sm:flex-row-reverse' : 'sm:flex-row'} gap-10 items-center`}>
      <div className="flex-1 space-y-4 text-left">
        <span className="inline-flex items-center gap-1.5 bg-card-cream border border-border-warm-grey text-[#1f4d3f] text-xs font-semibold px-3 py-1 rounded-full">
          {icon} {tag}
        </span>
        <h3 className="font-display text-2xl font-bold text-ink-text leading-snug">{title}</h3>
        <p className="font-body-lg text-muted-text">{body}</p>
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item} className="flex items-start gap-2 font-body-sm text-sm text-muted-text">
              <CheckCircle className="w-4 h-4 text-[#1f4d3f] shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 bg-card-cream border border-border-warm-grey rounded-2xl p-6 shadow-sm min-h-[160px] flex items-center justify-center text-muted-text font-body-sm text-sm text-center">
        <span className="opacity-50">[ App screenshot ]</span>
      </div>
    </div>
  );
}
