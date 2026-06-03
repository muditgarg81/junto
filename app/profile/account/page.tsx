'use strict';

import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import AccountClient from './AccountClient';

export default async function AccountPage() {
  // Fetch current user details
  const user = await getCurrentUser(true);
  if (!user) {
    notFound();
  }

  const initialUser = {
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    upi_id: user.upi_id ?? null,
    home_currency: user.home_currency ?? null,
    photo_url: user.photo_url ?? null,
    chat_prefs: user.chat_prefs,
    auth_id: user.auth_id,
  };

  return (
    <AccountClient
      initialUser={initialUser}
    />
  );
}
