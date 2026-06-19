'use client';

import { useEffect } from 'react';
import { initStatusBar } from '@/lib/native';
import { useRouter } from 'next/navigation';

export default function NativeInit() {
  const router = useRouter();

  useEffect(() => {
    initStatusBar();

    // Handle deep linking for native authentication flows
    const setupDeepLinks = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { App } = await import('@capacitor/app');
          const { Browser } = await import('@capacitor/browser');

          // Add listener to capture incoming URL custom schemes (juntofun://callback)
          await App.addListener('appUrlOpen', async (data: any) => {
            console.log('App opened with URL:', data.url);
            
            try {
              const url = new URL(data.url);
              if (url.protocol === 'juntofun:') {
                if (url.host === 'callback') {
                  const redirectPath = url.searchParams.get('redirect');
                  const token = url.searchParams.get('token');
                  if (redirectPath) {
                    let pathNonce = '';
                    try {
                      // redirectPath might be relative (e.g. "/home?nonce=abc")
                      const parsedPath = new URL(redirectPath, 'https://dummy.com');
                      pathNonce = parsedPath.searchParams.get('nonce') || '';
                    } catch (e) {
                      console.error('Failed to parse nonce from redirectPath:', e);
                    }

                    const storedNonce = localStorage.getItem('oauth_nonce');
                    if (storedNonce || pathNonce) {
                      if (pathNonce !== storedNonce) {
                        console.log('Nonce mismatch. Ignoring old/spurious deep link intent.', { pathNonce, storedNonce });
                        return;
                      }
                      // Clear the nonce so it cannot be reused
                      localStorage.removeItem('oauth_nonce');
                    }

                    // If a session token was passed, sync it to WebView cookies first
                    if (token) {
                      try {
                        const syncRes = await fetch(`/api/auth/session-sync?token=${encodeURIComponent(token)}`);
                        if (!syncRes.ok) {
                          console.error('Session sync API returned error:', await syncRes.text());
                        } else {
                          console.log('Session sync successful');
                        }
                      } catch (syncErr) {
                        console.error('Failed to call session-sync endpoint:', syncErr);
                      }
                    }

                    // Close Chrome Custom Tab securely
                    try {
                      await Browser.close();
                    } catch (err) {
                      console.warn('Browser.close failed or already closed:', err);
                    }
                    
                    // Force a hard navigation so the newly written cookies are parsed
                    window.location.href = redirectPath;
                  }
                }
              }
            } catch (err) {
              console.error('Failed to parse incoming deep link URL:', err);
            }
          });
        }
      } catch (err) {
        console.error('Error initializing deep link listener:', err);
      }
    };

    setupDeepLinks();

  }, []);

  return null;
}
