'use client';

import React, { useEffect, useRef } from 'react';

interface GYGCityWidgetProps {
  destination: string;
  numberOfItems?: number;
}

const GYG_PARTNER_ID = 'VTHTCXI';

export default function GYGCityWidget({ destination, numberOfItems = 3 }: GYGCityWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!containerRef.current || scriptLoaded.current) return;
    scriptLoaded.current = true;

    // GYG widget script — loads once globally
    const existing = document.getElementById('gyg-widget-script');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'gyg-widget-script';
      script.async = true;
      script.defer = true;
      script.src = 'https://widget.getyourguide.com/dist/pa.umd.production.min.js';
      script.setAttribute('data-gyg-partner-id', GYG_PARTNER_ID);
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">🎟️</span>
        <span className="font-label-caps text-[10px] text-ink-text font-bold tracking-wide">
          ACTIVITIES & EXPERIENCES
        </span>
        <span className="font-label-caps text-[9px] text-muted-text ml-auto">
          via GetYourGuide
        </span>
      </div>

      <div
        ref={containerRef}
        data-gyg-href="https://widget.getyourguide.com/default/city.frame"
        data-gyg-locale-code="en-US"
        data-gyg-widget="city"
        data-gyg-number-of-items={numberOfItems}
        data-gyg-partner-id={GYG_PARTNER_ID}
        data-gyg-q={destination}
        className="w-full rounded-xl overflow-hidden border border-border-warm-grey/60"
        style={{ minHeight: '280px' }}
      />

      <p className="text-[9px] text-muted-text text-center">
        Junto may earn a commission on bookings. Prices shown are live from GetYourGuide.
      </p>
    </div>
  );
}
