'use client';

import { useEffect } from 'react';
import { initStatusBar } from '@/lib/native';

export default function NativeInit() {
  useEffect(() => {
    initStatusBar();

    // Prevent the WebView from rubber-band scrolling the whole page
    // (individual scrollable containers still scroll fine)
    const prevent = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-scroll]')) return;
      if (document.documentElement.scrollTop === 0) e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  return null;
}
