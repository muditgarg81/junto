'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;

  try {
    // 1. Authorize session member access
    const { member } = await authorizeTripAccess(tripId);

    const { provider, amount } = await req.json();

    if (!provider) {
      return NextResponse.json({ error: 'Missing payment provider' }, { status: 400 });
    }

    const payAmount = amount || 499.00; // 499 INR default
    const upgradeId = crypto.randomUUID();

    // 2. Create pending trip upgrade (enforce paid_by = member.id from authenticated session)
    await query(
      `INSERT INTO trip_upgrades (id, trip_id, tier, paid_by, provider, amount, status)
       VALUES ($1, $2, 'boost', $3, $4, $5, 'pending')`,
      [
        upgradeId,
        tripId,
        member.id, // Enforce server-side identity
        provider,
        payAmount
      ]
    );

    // Return the checkout simulation path
    const checkoutUrl = `/checkout/${upgradeId}`;

    return NextResponse.json({ success: true, checkoutUrl, upgradeId });

  } catch (err: any) {
    console.error('Failed to initiate trip upgrade:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
