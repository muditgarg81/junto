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
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      // 1. Authorize member access
      const { member } = await authorizeTripAccess(tripId);
      
      const { type, title, options } = body;

      if (!type || !title || !options || !Array.isArray(options) || options.length === 0) {
        return NextResponse.json({ error: 'Missing proposal fields.' }, { status: 400 });
      }

      // 2. Create Decision
      const decisionId = crypto.randomUUID();
      await query(
        `INSERT INTO decisions (id, trip_id, type, title, status)
         VALUES ($1, $2, $3, $4, 'open')`,
        [decisionId, tripId, type, title]
      );

      if (type === 'hotel') {
        try {
          const { triggerOffers } = require('@/lib/offers');
          triggerOffers(tripId, 'hotel_decision_opened').catch(console.error);
        } catch (err) {
          console.error(err);
        }
      }

      // 3. Create Options (enforce proposed_by = member.id from authenticated session)
      for (const opt of options) {
        const optionId = crypto.randomUUID();
        await query(
          `INSERT INTO options (id, decision_id, label, payload, proposed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            optionId,
            decisionId,
            opt.label,
            JSON.stringify(opt.payload || {}),
            member.id, // Enforce server-side identity
          ]
        );
      }

      return NextResponse.json({ success: true, decisionId });
    }

    if (action === 'vote') {
      // 1. Authorize member access
      const { member } = await authorizeTripAccess(tripId);
      
      const { decisionId, optionId, value } = body;

      if (!decisionId || !optionId || !value) {
        return NextResponse.json({ error: 'Missing voting fields.' }, { status: 400 });
      }

      if (!['yes', 'no', 'abstain'].includes(value)) {
        return NextResponse.json({ error: 'Invalid vote value.' }, { status: 400 });
      }

      // 2. Insert or update vote (enforce member_id = member.id from session)
      await query(
        `INSERT INTO votes (id, decision_id, option_id, member_id, value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (option_id, member_id)
         DO UPDATE SET value = EXCLUDED.value`,
        [crypto.randomUUID(), decisionId, optionId, member.id, value]
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'lock') {
      // 1. Authorize organizer access
      const { member } = await authorizeTripAccess(tripId, { role: 'organizer' });
      
      const { decisionId, optionId } = body;

      if (!decisionId || !optionId) {
        return NextResponse.json({ error: 'Missing lock fields.' }, { status: 400 });
      }

      // Retrieve the option details
      const optionRes = await query('SELECT label FROM options WHERE id = $1', [optionId]);
      if (optionRes.rows.length === 0) {
        return NextResponse.json({ error: 'Option not found.' }, { status: 404 });
      }
      const optionLabel = optionRes.rows[0].label;

      const decisionRes = await query('SELECT title FROM decisions WHERE id = $1', [decisionId]);
      if (decisionRes.rows.length === 0) {
        return NextResponse.json({ error: 'Decision not found.' }, { status: 404 });
      }
      const decisionTitle = decisionRes.rows[0].title;

      // Lock decision
      await query(
        `UPDATE decisions 
         SET status = 'locked', resolved_option_id = $1 
         WHERE id = $2`,
        [optionId, decisionId]
      );

      // Post clean AI record message in chat
      await query(
        `INSERT INTO messages (id, trip_id, author_id, is_ai, body)
         VALUES ($1, $2, null, true, $3)`,
        [
          crypto.randomUUID(),
          tripId,
          `✓ ${decisionTitle} locked: ${optionLabel}`,
        ]
      );

      // Trigger offers if dates & destination are locked
      try {
        const checkRes = await query(
          "SELECT COUNT(1) as count FROM decisions WHERE trip_id = $1 AND type IN ('dates', 'destination') AND status = 'locked'",
          [tripId]
        );
        const count = parseInt(checkRes.rows[0].count, 10);
        if (count >= 2) {
          const { triggerOffers } = require('@/lib/offers');
          triggerOffers(tripId, 'dates_locked').catch(console.error);
        }
      } catch (err) {
        console.error('Failed to trigger locked offers:', err);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in proposal API:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    // 1. Authorize organizer access for deletion
    await authorizeTripAccess(tripId, { role: 'organizer' });
    
    const { decisionId } = await req.json();
    if (!decisionId) {
      return NextResponse.json({ error: 'Missing decisionId' }, { status: 400 });
    }

    // Retrieve details before deleting
    const decisionRes = await query('SELECT title FROM decisions WHERE id = $1', [decisionId]);
    if (decisionRes.rows.length > 0) {
      const decisionTitle = decisionRes.rows[0].title;
      await query(
        `INSERT INTO messages (id, trip_id, author_id, is_ai, body)
         VALUES ($1, $2, null, true, $3)`,
        [
          crypto.randomUUID(),
          tripId,
          `✗ Decision "${decisionTitle}" was deleted.`,
        ]
      );
    }

    // Delete decision
    await query('DELETE FROM decisions WHERE id = $1 AND trip_id = $2', [decisionId, tripId]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting decision:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
