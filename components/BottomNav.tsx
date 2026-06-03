'use strict';

'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, Map, Coins, Folder, Home } from 'lucide-react';

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

  return (
    <nav className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-4 py-2 flex justify-around items-center shadow-md">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-200 select-none ${
              isActive
                ? 'text-primary-container font-semibold'
                : 'text-muted-text hover:text-ink-text'
            }`}
          >
            <Icon className={`w-5.5 h-5.5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
            <span className="font-label-caps text-[10px] tracking-normal">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
