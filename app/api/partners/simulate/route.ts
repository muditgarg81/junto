'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // Only the system operator (default-mudit-garg) can simulate affiliate conversions
  const user = await getCurrentUser();
  if (!user || user.auth_id !== 'default-mudit-garg') {
    return NextResponse.json({ error: 'Unauthorized: Operator privilege required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { partner, subId, amount, commission } = body;

    if (!partner || !subId) {
      return NextResponse.json({ error: 'Missing partner or subId parameter.' }, { status: 400 });
    }

    const secret = process.env.PARTNER_POSTBACK_SECRET || 'junto-partner-postback-fallback-secret-2026';
    const amountStr = String(amount || '0');
    const commissionStr = String(commission || '0');

    // Generate HMAC signature on the server using private secret
    const payload = `${partner}:${subId}:${amountStr}:${commissionStr}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Resolve current server URL to route to postback route
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const url = `${proto}://${host}/api/partners/${partner}/postback`;

    // Make local server-to-server POST request to verify signature
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-junto-signature': signature,
      },
      body: JSON.stringify({
        subId,
        amount,
        commission,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Simulated postback rejected: ${errorText}` }, { status: res.status });
    }

    const responseData = await res.json();
    return NextResponse.json(responseData);

  } catch (err: any) {
    console.error('Failed to run partner postback simulation:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
