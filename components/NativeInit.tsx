'use client';

import { useEffect } from 'react';
import { initStatusBar } from '@/lib/native';
import { useRouter } from 'next/navigation';

export default function NativeInit() {
  const router = useRouter();

  useEffect(() => {
    initStatusBar();

    // Prevent the WebView from rubber-band scrolling the whole page
    // (individual scrollable containers still scroll fine)
    const prevent = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-scroll]')) return;
      if (document.documentElement.scrollTop === 0) e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });

    // Handle deep linking for native authentication flows
    const setupDeepLinks = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { App } = await import('@capacitor/app');
          const { Browser } = await import('@capacitor/browser');

          // Add listener to capture incoming URL custom schemes (juntofun://callback)
          await App.addListener('appUrlOpen', async (data: any) => {
            alert('debug: appUrlOpen triggered! URL:\n' + data.url);
            console.log('App opened with URL:', data.url);
            
            try {
              const url = new URL(data.url);
              if (url.protocol === 'juntofun:') {
                if (url.host === 'callback') {
                  const redirectPath = url.searchParams.get('redirect');
                  if (redirectPath) {
                    let pathNonce = '';
                    try {
                      // redirectPath might be relative (e.g. "/home?nonce=abc")
                      const parsedPath = new URL(redirectPath, 'https://dummy.com');
                      pathNonce = parsedPath.searchParams.get('nonce') || '';
                    } catch (e) {
                      console.error('Failed to parse nonce from redirectPath:', e);
                    }

                    const storedNonce = sessionStorage.getItem('oauth_nonce');
                    if (storedNonce || pathNonce) {
                      if (pathNonce !== storedNonce) {
                        alert('debug: Nonce mismatch! Ignoring deep link.\npathNonce: ' + pathNonce + '\nstoredNonce: ' + storedNonce);
                        console.log('Nonce mismatch. Ignoring old/spurious deep link intent.', { pathNonce, storedNonce });
                        return;
                      }
                      // Clear the nonce so it cannot be reused
                      sessionStorage.removeItem('oauth_nonce');
                    }

                    alert('debug: Nonce matched! Closing Custom Tab and redirecting to:\n' + redirectPath);

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

    return () => {
      document.removeEventListener('touchmove', prevent);
    };
  }, []);

  return null;
}
