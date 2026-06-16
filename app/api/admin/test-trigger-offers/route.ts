'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { triggerOffers } from '@/lib/offers';

function isAuthorized(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.nextUrl.searchParams.get('secret') === secret;
}

const VALID_TRIGGERS = [
  'dates_locked',
  'hotel_decision_opened',
  'flight_voucher_ingested',
  'activity_interest',
  'transport_expense',
];

/**
 * GET /api/admin/test-trigger-offers?secret=<>&tripId=<>&trigger=<>
 *   Manually fires triggerOffers() for a trip + trigger type, to verify
 *   offer surfacing end-to-end without going through the full app flow.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tripId = req.nextUrl.searchParams.get('tripId');
  const trigger = req.nextUrl.searchParams.get('trigger');

  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });
  if (!trigger || !VALID_TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: `trigger must be one of: ${VALID_TRIGGERS.join(', ')}` }, { status: 400 });
  }

  await triggerOffers(tripId, trigger as any);

  return NextResponse.json({ success: true, tripId, trigger, message: 'Check /admin/affiliates or the offers table for new rows.' });
}
