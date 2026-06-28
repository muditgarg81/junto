'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, MessageSquare, Coins, Map, Package } from 'lucide-react';

interface Step {
  iconName: 'chat' | 'map' | 'coins' | 'package';
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    iconName: 'chat',
    title: 'Chat naturally',
    body: "Just talk like you normally would. Junto's AI listens and builds your trip plan automatically - no forms, no setup.",
  },
  {
    iconName: 'map',
    title: 'One living plan',
    body: "Your itinerary, decisions, and votes update in real time for everyone. No more hunting for the latest doc.",
  },
  {
    iconName: 'coins',
    title: 'Split expenses easily',
    body: "Log costs as you go. Junto calculates who owes what and generates a UPI payment link - settle in seconds.",
  },
  {
    iconName: 'package',
    title: 'All your docs in one place',
    body: "Upload flight tickets, hotel vouchers, and bookings. Junto reads them and adds the details to your itinerary.",
  },
];

function StepIcon({ name }: { name: Step['iconName'] }) {
  const cls = 'w-10 h-10 text-primary-container';
  if (name === 'chat') return <MessageSquare className={cls} />;
  if (name === 'map') return <Map className={cls} />;
  if (name === 'coins') return <Coins className={cls} />;
  return <Package className={cls} />;
}

export function OnboardingWalkthrough() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem('junto_onboarded')) setVisible(true);
    } catch { /* SSR / private browsing */ }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('junto_onboarded', '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else dismiss();
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
      <div className="w-full max-w-sm bg-card-cream rounded-3xl shadow-2xl border border-border-warm-grey overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-5 h-1.5 bg-primary-container'
                  : i < step
                  ? 'w-1.5 h-1.5 bg-primary-container/40'
                  : 'w-1.5 h-1.5 bg-border-warm-grey'
              }`}
            />
          ))}
        </div>

        <div className="px-7 py-6 space-y-5 text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-ai-sage-tint flex items-center justify-center">
              <StepIcon name={current.iconName} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl text-ink-text font-bold">{current.title}</h2>
            <p className="font-body-md text-muted-text text-sm leading-relaxed">{current.body}</p>
          </div>
        </div>

        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-border-warm-grey text-muted-text font-label-caps text-[10px] tracking-wider hover:bg-surface-container-low transition"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="flex-[2] py-2.5 rounded-xl bg-primary-container text-surface font-label-caps text-[10px] tracking-wider flex items-center justify-center gap-1.5 hover:bg-primary transition"
          >
            {step < STEPS.length - 1 ? (
              <>Next <ChevronRight className="w-3.5 h-3.5" /></>
            ) : (
              'Get started'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
