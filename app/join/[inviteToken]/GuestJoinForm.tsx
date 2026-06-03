'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinTripAction } from './actions';
import { User, Check, AlertCircle } from 'lucide-react';
import { User as UserType } from '@/lib/types';

interface GuestJoinFormProps {
  inviteToken: string;
  user: UserType;
}

export default function GuestJoinForm({ inviteToken, user }: GuestJoinFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'confirmed' | 'maybe'>('confirmed');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await joinTripAction(inviteToken, status, formData);
      if (res.error) {
        setError(res.error);
      } else if (res.success && res.tripId) {
        router.push(`/trip/${res.tripId}/chat`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Badge Card (No Name Input) */}
      <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl flex items-center gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-primary-container text-surface-container-lowest flex items-center justify-center font-display font-semibold overflow-hidden">
          {user.photo_url ? (
            <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="text-left min-w-0">
          <span className="block font-label-caps text-[9px] text-muted-text font-bold uppercase tracking-wider">
            Joining as
          </span>
          <span className="block font-body-md text-ink-text font-semibold truncate">
            {user.name}
          </span>
        </div>
      </div>

      {/* Rsvp Status Selector Card */}
      <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl space-y-3 shadow-sm">
        <label className="block font-label-caps text-muted-text">Will you be joining?</label>
        <div className="grid grid-cols-2 gap-3">
          {/* Going button */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus('confirmed')}
            className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-body-md font-medium transition duration-200 ${
              status === 'confirmed'
                ? 'bg-primary-container text-surface-container-lowest border-transparent shadow-sm'
                : 'border-border-warm-grey text-muted-text hover:text-ink-text hover:bg-surface-container-low'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${status === 'confirmed' ? 'bg-surface' : 'bg-[#1f4d3f]'}`} />
            I&apos;m going
          </button>

          {/* Maybe button */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus('maybe')}
            className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-body-md font-medium transition duration-200 ${
              status === 'maybe'
                ? 'bg-[#B98A3C] text-surface-container-lowest border-transparent shadow-sm'
                : 'border-border-warm-grey text-muted-text hover:text-ink-text hover:bg-surface-container-low'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${status === 'maybe' ? 'bg-surface' : 'bg-[#B98A3C]'}`} />
            Maybe
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-secondary text-sm bg-secondary/10 border border-secondary/20 p-3.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary-container hover:bg-primary disabled:bg-outline-variant text-surface-container-lowest font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm transition duration-200"
      >
        {isPending ? 'Joining...' : 'Join trip'}
      </button>
    </form>
  );
}
