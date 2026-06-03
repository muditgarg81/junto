import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.junto.travel',
  appName: 'Junto',
  webDir: 'out',
  server: {
    url: 'https://junto-travel-app.vercel.app',
    cleartext: true
  }
};

export default config;
