'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runAiOrchestrator } from '@/lib/ai-orchestrator';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;

  // Rate limiting check
  const ip = getClientIp(req);
  const rateLimitKey = `${ip}:message:${tripId}`;
  if (isRateLimited(rateLimitKey, 10, 60)) {
    return NextResponse.json({ error: 'Too many messages. Please slow down.' }, { status: 429 });
  }

  try {
    // 1. Authorize session member access
    const { member } = await authorizeTripAccess(tripId);

    const { body } = await req.json();

    if (!body || !body.trim()) {
      return NextResponse.json({ error: 'Message body cannot be empty.' }, { status: 400 });
    }

    const messageId = crypto.randomUUID();

    // 2. Insert message into messages table (enforce author_id = member.id from authenticated session)
    await query(
      `INSERT INTO messages (id, trip_id, author_id, is_ai, body)
       VALUES ($1, $2, $3, false, $4)`,
      [messageId, tripId, member.id, body.trim()]
    );

    // 3. Launch background AI Orchestrator asynchronously (non-blocking)
    runAiOrchestrator(tripId, messageId).catch((err) => {
      console.error('Background AI Orchestrator failed:', err);
    });

    // 4. Return success immediately so the client updates instantly
    return NextResponse.json({ success: true, messageId });
  } catch (err: any) {
    console.error('Error posting message:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
