'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

// Verify the postback signature to prevent conversion spoofing/fraud
function verifySignature(
  partner: string,
  subId: string,
  amount: string,
  commission: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  
  const secret = process.env.PARTNER_POSTBACK_SECRET || 'junto-partner-postback-fallback-secret-2026';
  const payload = `${partner}:${subId}:${amount}:${commission}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (e) {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partner: string }> }
) {
  const { partner } = await params;
  const searchParams = req.nextUrl.searchParams;

  const subId = searchParams.get('sub_id') || searchParams.get('subId');
  const amountStr = searchParams.get('amount') || '0';
  const commissionStr = searchParams.get('commission') || '0';
  const signature = req.headers.get('x-junto-signature') || searchParams.get('signature');

  if (!subId || !verifySignature(partner, subId, amountStr, commissionStr, signature)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
  }

  return handlePostback(partner, subId, amountStr, commissionStr);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partner: string }> }
) {
  const { partner } = await params;
  try {
    const body = await req.json();
    const subId = body.sub_id || body.subId;
    const amountStr = String(body.amount || '0');
    const commissionStr = String(body.commission || '0');
    const signature = req.headers.get('x-junto-signature') || req.nextUrl.searchParams.get('signature');

    if (!subId || !verifySignature(partner, subId, amountStr, commissionStr, signature)) {
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    return handlePostback(partner, subId, amountStr, commissionStr);
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid JSON payload or signature' }, { status: 400 });
  }
}

async function handlePostback(partner: string, subId: string | null, amountStr: string, commissionStr: string) {
  if (!subId) {
    return NextResponse.json({ error: 'Missing subId parameter' }, { status: 400 });
  }

  const grossAmount = parseFloat(amountStr) || 0;
  const commission = parseFloat(commissionStr) || 0;

  try {
    const parts = subId.split('.');
    const offerId = parts[1];

    // 1. Insert into conversions
    const conversionId = crypto.randomUUID();
    await query(
      `INSERT INTO conversions (id, offer_id, sub_id, gross_amount, commission)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        conversionId,
        offerId || null,
        subId,
        grossAmount,
        commission
      ]
    );

    // 2. Update offer status to 'converted'
    if (offerId) {
      await query(
        "UPDATE offers SET status = 'converted' WHERE id = $1",
        [offerId]
      );
    }

    console.log(`Conversion webhook: Recorded signed conversion ${conversionId} from ${partner} for subId: ${subId}. Commission: ${commission}`);

    return NextResponse.json({ success: true, conversionId });
  } catch (err: any) {
    console.error('Postback handler failed:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
