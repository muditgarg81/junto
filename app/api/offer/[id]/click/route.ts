'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getTrackingUrl } from '@/lib/offers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: offerId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const memberId = searchParams.get('memberId') || 'guest';

  try {
    // 1. Fetch the offer details
    const offerRes = await query('SELECT * FROM offers WHERE id = $1', [offerId]);
    if (offerRes.rows.length === 0) {
      return new NextResponse('Offer Not Found', { status: 404 });
    }
    const offer = offerRes.rows[0];

    // 2. Build subId
    const subId = `${offer.trip_id}.${offer.id}.${memberId}`;

    // 3. Log click in offer_clicks
    await query(
      `INSERT INTO offer_clicks (id, offer_id, member_id, sub_id)
       VALUES ($1, $2, $3, $4)`,
      [
        crypto.randomUUID(),
        offerId,
        memberId === 'guest' ? null : memberId,
        subId
      ]
    );

    // 4. Update offer status to 'clicked'
    await query(
      "UPDATE offers SET status = 'clicked' WHERE id = $1 AND status = 'shown'",
      [offerId]
    );

    // 5. Generate dynamic affiliate URL
    const trackingUrl = getTrackingUrl(offer, memberId);

    // 6. 302 Redirect
    return NextResponse.redirect(trackingUrl, 302);

  } catch (err: any) {
    console.error('Error tracking offer click:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
