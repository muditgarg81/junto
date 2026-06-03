'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import CheckoutClient from './CheckoutClient';

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default async function CheckoutPage({ params }: PageProps) {
  const { ref: upgradeId } = await params;

  // 1. Fetch Upgrade Details
  const upgradeRes = await query(
    `SELECT u.*, t.name as trip_name 
     FROM trip_upgrades u 
     JOIN trips t ON u.trip_id = t.id 
     WHERE u.id = $1`, 
    [upgradeId]
  );
  if (upgradeRes.rows.length === 0) {
    notFound();
  }
  
  const upgrade = upgradeRes.rows[0];

  return (
    <CheckoutClient
      upgradeId={upgrade.id}
      tripId={upgrade.trip_id}
      tripName={upgrade.trip_name}
      amount={upgrade.amount}
      provider={upgrade.provider}
    />
  );
}
