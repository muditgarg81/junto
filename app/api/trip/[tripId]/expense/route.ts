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

    const body = await req.json();
    const { action } = body;

    // Confirm AI-drafted expense
    if (action === 'confirm') {
      const { expenseId } = body;
      if (!expenseId) {
        return NextResponse.json({ error: 'Missing expenseId.' }, { status: 400 });
      }

      // Enforce trip context to prevent IDOR deletions/modifications of other trips
      const updateRes = await query(
        `UPDATE expenses 
         SET source = 'manual' 
         WHERE id = $1 AND trip_id = $2`,
        [expenseId, tripId]
      );

      if (updateRes.rowCount === 0) {
        return NextResponse.json({ error: 'Expense not found in this trip.' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Create custom manual expense
    if (action === 'create') {
      const { amount, description, category, splitType, splits, paidBy } = body;

      if (!amount || !description || !splitType || !splits || !Array.isArray(splits)) {
        return NextResponse.json({ error: 'Missing required expense fields.' }, { status: 400 });
      }

      let payerId = member.id;
      if (paidBy) {
        const payerCheck = await query(
          'SELECT id FROM members WHERE id = $1 AND trip_id = $2 LIMIT 1',
          [paidBy, tripId]
        );
        if (payerCheck.rows.length > 0) {
          payerId = paidBy;
        } else {
          return NextResponse.json({ error: 'Invalid payer member ID.' }, { status: 400 });
        }
      }

      const expenseId = crypto.randomUUID();

      await query(
        `INSERT INTO expenses (id, trip_id, paid_by, amount, currency, fx_rate, description, category, split_type, source)
         VALUES ($1, $2, $3, $4, 'INR', 1.0, $5, $6, $7, 'manual')`,
        [expenseId, tripId, payerId, amount, description, category || 'Other', splitType]
      );

      // Insert Splits rows
      for (const split of splits) {
        await query(
          `INSERT INTO splits (id, expense_id, member_id, weight, exact_amount)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            crypto.randomUUID(),
            expenseId,
            split.memberId,
            split.weight !== undefined ? Number(split.weight) : null,
            split.exactAmount !== undefined ? Number(split.exactAmount) : null,
          ]
        );
      }

      return NextResponse.json({ success: true, expenseId });
    }

    // Delete expense
    if (action === 'delete') {
      const { expenseId } = body;
      if (!expenseId) {
        return NextResponse.json({ error: 'Missing expenseId.' }, { status: 400 });
      }

      // Enforce trip context to prevent deleting other trips' expenses
      const deleteRes = await query('DELETE FROM expenses WHERE id = $1 AND trip_id = $2', [expenseId, tripId]);
      if (deleteRes.rowCount === 0) {
        return NextResponse.json({ error: 'Expense not found in this trip.' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Update member UPI ID (Only allowed for the active session's own member ID)
    if (action === 'update_upi') {
      const { upiId } = body;
      if (upiId === undefined) {
        return NextResponse.json({ error: 'Missing upiId.' }, { status: 400 });
      }

      await query(
        `UPDATE members 
         SET upi_id = $1 
         WHERE id = $2 AND trip_id = $3`,
        [upiId && upiId.trim() !== '' ? upiId.trim() : null, member.id, tripId]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in expense API:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
