'use strict';

import React from 'react';
import { cookies } from 'next/headers';
import OnboardingClient from './OnboardingClient';

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('junto_auth_session')?.value;
  let initialEmail = '';
  let initialName = '';

  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      if (session.email) initialEmail = session.email;
      if (session.name && session.name !== 'New Traveler' && !session.name.startsWith('Email')) {
        initialName = session.name;
      }
    } catch (e) {
      console.error('Error parsing junto_auth_session cookie in page:', e);
    }
  }

  return (
    <OnboardingClient 
      initialEmail={initialEmail}
      initialName={initialName}
    />
  );
}
