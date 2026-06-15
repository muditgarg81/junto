import React from 'react';
import WelcomeClient from './WelcomeClient';

// Homepage is always the landing page (static, no auth dependency).
// Logged-in users are redirected to /trips client-side by WelcomeClient.
export default function HomePage() {
  return <WelcomeClient user={null} />;
}
