import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'junto.package.app',
  appName: 'Junto',
  webDir: 'out',
  server: {
    url: 'https://junto-three.vercel.app',
    cleartext: true
  }
};

export default config;
