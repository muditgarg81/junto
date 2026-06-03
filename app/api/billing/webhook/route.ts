'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { upgradeId, status, providerRef } = await req.json();

    if (!upgradeId || !status) {
      return NextResponse.json({ error: 'Missing upgradeId or status' }, { status: 400 });
    }

    const dbStatus = status === 'success' ? 'active' : 'failed';

    // 1. Fetch current upgrade to verify trip_id
    const upgradeRes = await query('SELECT trip_id FROM trip_upgrades WHERE id = $1', [upgradeId]);
    if (upgradeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Upgrade session not found' }, { status: 404 });
    }
    const { trip_id } = upgradeRes.rows[0];

    // 2. Update status of the upgrade
    await query(
      `UPDATE trip_upgrades 
       SET status = $1, provider_ref = $2 
       WHERE id = $3`,
      [dbStatus, providerRef || null, upgradeId]
    );

    // 3. Post System AI confirmation message in chat if successful
    if (dbStatus === 'active') {
      await query(
        `INSERT INTO messages (id, trip_id, author_id, is_ai, body)
         VALUES ($1, $2, null, true, $3)`,
        [
          crypto.randomUUID(),
          trip_id,
          '✓ Trip upgraded to Boost! Group AI insights, larger vault capacities, and fast parsing unlocked.'
        ]
      );
      console.log(`Billing Webhook: Upgrade ${upgradeId} for trip ${trip_id} set to ACTIVE.`);
    } else {
      console.log(`Billing Webhook: Upgrade ${upgradeId} set to ${dbStatus}.`);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Billing webhook failed:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
