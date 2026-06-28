import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Mobile architecture: Capacitor WebView loads the hosted Next.js app (Vercel).
 * All client fetch() calls use relative paths which resolve to the same origin.
 * sameSite: lax session cookies work correctly because WebView origin === server origin.
 * No static export (output: 'export') is used or needed.
 *
 * For local dev: set CAPACITOR_SERVER_URL=http://<your-LAN-IP>:3000 before `npx cap sync`.
 * For production: leave unset → defaults to the Vercel deployment below.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://junto-three.vercel.app';
const isDev = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'app.juntofun',
  appName: 'JuntoFun',
  webDir: 'out', // fallback only — not used when server.url is set
  server: {
    url: serverUrl,
    // cleartext (plain HTTP) only permitted in local dev; never in production
    cleartext: isDev,
    // Shown when the remote server is unreachable (no internet)
    errorPath: 'offline.html',
  },
};

export default config;
