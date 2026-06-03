import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CreateTripClient from './CreateTripClient';

export default async function CreateTripPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/onboarding?redirect=/create-trip');
  }

  return (
    <CreateTripClient
      user={user}
    />
  );
}
