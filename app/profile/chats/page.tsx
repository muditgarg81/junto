'use strict';

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Bell, AtSign, VolumeX, Wifi, HardDrive, Palette, Type, CheckSquare, EyeOff, Archive
} from 'lucide-react';

export default function ChatsSettingsPage() {
  // Preference states
  const [notifications, setNotifications] = useState(true);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [autoDownload, setAutoDownload] = useState<'wifi' | 'cellular' | 'never'>('wifi');
  const [saveToGallery, setSaveToGallery] = useState(true);
  const [chatTheme, setChatTheme] = useState<'light' | 'dark' | 'paper'>('paper');
  const [fontSize, setFontSize] = useState<number>(16); // font size slider value
  const [readReceipts, setReadReceipts] = useState(true);

  // Computed class based on appearance states
  const getThemeClass = () => {
    if (chatTheme === 'paper') return 'bg-[#fff9ed] text-[#211F1A] border-[#D9D4CB]';
    if (chatTheme === 'dark') return 'bg-[#1e1e1e] text-[#f5f5f5] border-[#333]';
    return 'bg-white text-gray-900 border-gray-200';
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between max-w-md mx-auto w-full border-x border-border-warm-grey shadow-sm">
      <div className="flex-grow px-6 py-6 space-y-6 pb-24 z-10 text-left">
        
        {/* Header App Bar */}
        <div className="flex items-center gap-3">
          <Link href="/profile" className="text-ink-text hover:text-secondary transition">
            <ChevronLeft className="w-5.5 h-5.5" />
          </Link>
          <div>
            <h1 className="font-display text-4xl text-ink-text leading-tight font-bold">Chats</h1>
            <p className="font-body-sm text-muted-text">Chat preferences & appearance settings</p>
          </div>
        </div>

        {/* Group 1: Notifications */}
        <section className="space-y-3">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">NOTIFICATIONS</h3>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl overflow-hidden divide-y divide-border-warm-grey/50 shadow-xs">
            
            {/* Message Notifications Toggle */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <Bell className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Message notifications</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={notifications} 
                  onChange={(e) => setNotifications(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-border-warm-grey peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Mentions Only Toggle */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <AtSign className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Mentions only</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={mentionsOnly} 
                  onChange={(e) => setMentionsOnly(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-border-warm-grey peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Muted Trips Row */}
            <button 
              onClick={() => alert('Muted Trips: Goa Summer (muted until Jun 10), Rome (muted forever).')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-3.5">
                <VolumeX className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Muted trips</span>
              </div>
              <span className="font-body-sm text-xs text-muted-text mr-2">2 muted</span>
            </button>

          </div>
        </section>

        {/* Group 2: Media */}
        <section className="space-y-3">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">MEDIA AUTO-DOWNLOAD</h3>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl overflow-hidden divide-y divide-border-warm-grey/50 shadow-xs">
            
            {/* Auto-download Segmented Controls */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3.5 text-muted-text">
                <Wifi className="w-5 h-5" />
                <span className="font-body-md text-ink-text text-sm">Auto-download media</span>
              </div>
              <div className="flex bg-surface p-1 rounded-xl border border-border-warm-grey">
                <button
                  onClick={() => setAutoDownload('wifi')}
                  className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                    autoDownload === 'wifi' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
                  }`}
                >
                  Wi-Fi Only
                </button>
                <button
                  onClick={() => setAutoDownload('cellular')}
                  className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                    autoDownload === 'cellular' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
                  }`}
                >
                  Wi-Fi + Cellular
                </button>
                <button
                  onClick={() => setAutoDownload('never')}
                  className={`flex-grow py-1.5 rounded-lg font-label-caps text-[9px] tracking-normal transition ${
                    autoDownload === 'never' ? 'bg-card-cream text-primary font-semibold shadow-xs' : 'text-muted-text hover:text-ink-text'
                  }`}
                >
                  Never
                </button>
              </div>
            </div>

            {/* Save to Gallery Toggle */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <HardDrive className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Save to gallery</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={saveToGallery} 
                  onChange={(e) => setSaveToGallery(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-border-warm-grey peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

          </div>
        </section>

        {/* Group 3: Appearance */}
        <section className="space-y-3">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">APPEARANCE</h3>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl p-4 shadow-xs space-y-4">
            
            {/* Theme Swatches */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3.5 text-muted-text">
                <Palette className="w-5 h-5" />
                <span className="font-body-md text-ink-text text-sm">Chat theme</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => setChatTheme('light')}
                  className={`py-3.5 rounded-xl border text-center text-xs font-semibold font-body-sm transition bg-white text-gray-900 ${
                    chatTheme === 'light' ? 'border-primary ring-2 ring-primary/10 font-bold' : 'border-border-warm-grey'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setChatTheme('dark')}
                  className={`py-3.5 rounded-xl border text-center text-xs font-semibold font-body-sm transition bg-[#1e1e1e] text-surface ${
                    chatTheme === 'dark' ? 'border-primary ring-2 ring-primary/10 font-bold' : 'border-border-warm-grey'
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setChatTheme('paper')}
                  className={`py-3.5 rounded-xl border text-center text-xs font-semibold font-body-sm transition bg-[#fff9ed] text-ink-text ${
                    chatTheme === 'paper' ? 'border-primary ring-2 ring-primary/10 font-bold' : 'border-border-warm-grey'
                  }`}
                >
                  Paper
                </button>
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3.5 text-muted-text">
                <Type className="w-5 h-5" />
                <span className="font-body-md text-ink-text text-sm">Font size ({fontSize}px)</span>
              </div>
              <input 
                type="range" 
                min="12" 
                max="20" 
                value={fontSize} 
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-primary bg-surface h-1.5 rounded-lg border border-border-warm-grey appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-label-caps text-muted-text">
                <span>Small (12px)</span>
                <span>Default (16px)</span>
                <span>Large (20px)</span>
              </div>
            </div>

            {/* Live Chat Bubble Preview */}
            <div className="space-y-2 pt-2 border-t border-border-warm-grey/50">
              <span className="font-label-caps text-[9px] text-muted-text">LIVE PREVIEW</span>
              <div className={`p-4 rounded-xl border transition-colors flex flex-col gap-3 ${getThemeClass()}`}>
                <div className="flex gap-2 max-w-[80%] self-start">
                  <div className="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center font-bold text-[9px]">G</div>
                  <div className="bg-surface-container-high rounded-xl p-3 shadow-xs">
                    <p className="font-body-md leading-snug" style={{ fontSize: `${fontSize}px` }}>
                      Have we locked dates for Venice yet? 🇮🇹
                    </p>
                  </div>
                </div>
                <div className="bg-primary text-white rounded-xl p-3 shadow-xs max-w-[80%] self-end">
                  <p className="font-body-md leading-snug" style={{ fontSize: `${fontSize}px` }}>
                    Yes, check the Plan resource tiles! 🗺️
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Group 4: Privacy */}
        <section className="space-y-3">
          <h3 className="font-label-caps text-[10px] tracking-widest text-muted-text uppercase px-1">PRIVACY</h3>
          <div className="bg-card-cream border border-border-warm-grey rounded-2xl overflow-hidden divide-y divide-border-warm-grey/50 shadow-xs">
            
            {/* Read Receipts Toggle */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3.5">
                <CheckSquare className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Read receipts</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={readReceipts} 
                  onChange={(e) => setReadReceipts(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-border-warm-grey peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Archived Chats Row */}
            <button 
              onClick={() => alert('No archived chats.')}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition duration-150 text-left"
            >
              <div className="flex items-center gap-3.5">
                <Archive className="w-5 h-5 text-muted-text" />
                <span className="font-body-md text-ink-text text-sm">Archived chats</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-text/30 rotate-180" />
            </button>

          </div>
        </section>

      </div>

      {/* Footer Nav back home */}
      <footer className="bg-card-cream border-t border-border-warm-grey sticky bottom-0 left-0 right-0 z-30 max-w-md mx-auto w-full px-6 py-4 flex justify-between items-center shadow-md">
        <Link href="/profile" className="font-label-caps text-xs text-[#1f4d3f] hover:underline font-bold">
          ← Back to Hub
        </Link>
        <span className="font-label-caps text-[10px] text-muted-text">Junto Chat Settings</span>
      </footer>
    </div>
  );
}
