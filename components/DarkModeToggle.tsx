'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('junto_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('junto_theme', next ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="relative inline-flex items-center cursor-pointer"
      aria-label="Toggle dark mode"
    >
      <span className="sr-only">{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
      <div className={`w-9 h-5 rounded-full transition-colors ${dark ? 'bg-primary-container' : 'bg-border-warm-grey'}`}>
        <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'} flex items-center justify-center`}>
          {dark
            ? <Moon className="w-2.5 h-2.5 text-primary-container" />
            : <Sun className="w-2.5 h-2.5 text-amber-400" />}
        </div>
      </div>
    </button>
  );
}
