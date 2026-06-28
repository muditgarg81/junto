'use client';

import { Star, Moon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { DarkModeToggle } from '@/components/DarkModeToggle';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=junto.package.app';

export function ProfileActions() {
  return (
    <>
      {/* Dark mode row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3.5">
          <Moon className="w-5 h-5 text-muted-text" />
          <span className="font-body-md text-ink-text text-sm">Dark mode</span>
        </div>
        <DarkModeToggle />
      </div>

      {/* Rate app row */}
      <div className="border-t border-border-warm-grey/50">
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition active:scale-[0.99] duration-150"
        >
          <div className="flex items-center gap-3.5">
            <Star className="w-5 h-5 text-muted-text" />
            <span className="font-body-md text-ink-text text-sm">Rate Junto on Play Store</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-text/40" />
        </a>
      </div>
    </>
  );
}
