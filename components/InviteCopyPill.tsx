'use strict';

'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface InviteCopyPillProps {
  inviteLink: string;
}

export default function InviteCopyPill({ inviteLink }: InviteCopyPillProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join our trip on Junto',
          text: `Join our travel group chat and plan: ${inviteLink}`,
          url: inviteLink,
        });
      } catch (err) {
        console.error('Error sharing: ', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl shadow-sm space-y-3">
      <div className="text-xs font-label-caps text-muted-text">Invite your friends</div>
      <div className="flex items-center gap-2">
        <div className="flex-grow bg-surface border border-border-warm-grey px-4 py-2.5 rounded-full text-xs font-body-md text-ink-text truncate select-all">
          {inviteLink}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center p-2.5 bg-primary-container text-surface-container-lowest hover:bg-primary rounded-full transition duration-200 shadow-sm"
          title="Copy Link"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        {typeof navigator !== 'undefined' && !!(navigator as any).share && (
          <button
            onClick={handleShare}
            className="flex items-center justify-center p-2.5 border border-outline-variant hover:border-outline text-ink-text rounded-full transition duration-200 hover:bg-surface-container-low"
            title="Share Link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="text-[11px] font-body-sm text-muted-text text-center">
        {copied ? 'Link copied to clipboard!' : 'Send this link to your group chat.'}
      </div>
    </div>
  );
}
