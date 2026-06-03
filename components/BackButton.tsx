'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export function BackButton() {
  const router = useRouter();
  
  return (
    <button 
      onClick={() => router.back()}
      className="absolute top-6 left-6 p-2 rounded-full border border-border-warm-grey bg-card-cream hover:bg-surface-container text-ink-text transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs z-50 flex items-center justify-center cursor-pointer"
      title="Go back"
      aria-label="Go back"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
  );
}
