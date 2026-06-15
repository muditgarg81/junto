import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runProactiveConciergeChecks } from '@/lib/concierge-service';

const CONCIERGE_INTERVAL_MINUTES = 15;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized invocations
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Select active/planning trips that are not in cooldown and haven't run recently
    const eligibleTrips = await query(`
      SELECT id FROM trips
      WHERE status IN ('planning', 'active')
        AND (concierge_cooldown_until IS NULL OR concierge_cooldown_until < NOW())
        AND (
          last_concierge_run_at IS NULL
          OR last_concierge_run_at < NOW() - INTERVAL '${CONCIERGE_INTERVAL_MINUTES} minutes'
        )
      ORDER BY last_concierge_run_at ASC NULLS FIRST
      LIMIT 20
    `);

    const results: { tripId: string; status: string }[] = [];

    for (const row of eligibleTrips.rows) {
      const tripId: string = row.id;

      // Atomic claim: only proceed if we win the UPDATE race
      const claimRes = await query(`
        UPDATE trips
        SET last_concierge_run_at = NOW()
        WHERE id = $1
          AND (concierge_cooldown_until IS NULL OR concierge_cooldown_until < NOW())
          AND (
            last_concierge_run_at IS NULL
            OR last_concierge_run_at < NOW() - INTERVAL '${CONCIERGE_INTERVAL_MINUTES} minutes'
          )
        RETURNING id
      `, [tripId]);

      if (claimRes.rows.length === 0) {
        // Another concurrent invocation claimed this trip
        results.push({ tripId, status: 'skipped_claimed' });
        continue;
      }

      try {
        await runProactiveConciergeChecks(tripId);
        results.push({ tripId, status: 'ok' });
      } catch (err: any) {
        const is429 = err?.status === 429 || (err?.message || '').includes('429') || (err?.message || '').includes('quota');

        if (is429) {
          // Back off this trip for 30 minutes on rate limit
          await query(`
            UPDATE trips
            SET concierge_cooldown_until = NOW() + INTERVAL '30 minutes'
            WHERE id = $1
          `, [tripId]);
          results.push({ tripId, status: 'rate_limited' });
        } else {
          console.error(`Concierge check failed for trip ${tripId}:`, err);
          results.push({ tripId, status: 'error' });
        }
      }
    }

    return NextResponse.json({ ran: results.length, results });
  } catch (err) {
    console.error('Cron concierge route failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
