'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, Map, Coins, Folder, Home } from 'lucide-react';
import { hapticTap } from '@/lib/native';

interface BottomNavProps {
  tripId: string;
  activeTab: 'home' | 'chat' | 'plan' | 'money' | 'vault' | 'none';
}

export default function BottomNav({ tripId, activeTab }: BottomNavProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home, href: '/' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, href: `/trip/${tripId}/chat` },
    { id: 'plan', label: 'Plan', icon: Map, href: `/trip/${tripId}/plan` },
    { id: 'money', label: 'Money', icon: Coins, href: `/trip/${tripId}/money` },
    { id: 'vault', label: 'Vault', icon: Folder, href: `/trip/${tripId}/vault` },
  ];

  const handleTap = useCallback(() => {
    hapticTap();
  }, []);

  return (
    <nav className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-4 pt-2 pb-nav-safe flex justify-around items-center shadow-md">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={handleTap}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-150 select-none active:scale-90 ${
              isActive
                ? 'text-primary-container font-semibold'
                : 'text-muted-text hover:text-ink-text'
            }`}
          >
            <Icon className={`w-5.5 h-5.5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
            <span className="font-label-caps text-[10px] tracking-normal">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
