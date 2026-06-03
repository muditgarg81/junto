import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrf } from '@/lib/csrf';

// Unsettled balance calculation logic
async function checkUnsettledBalances(userId: string, authId: string): Promise<{ tripName: string; balance: number }[]> {
  const membersRes = await query('SELECT * FROM members WHERE user_id = $1 OR auth_id = $2', [userId, authId]);
  if (membersRes.rows.length === 0) return [];

  const unsettledTrips: { tripName: string; balance: number }[] = [];

  for (const member of membersRes.rows) {
    const tripId = member.trip_id;
    const memberId = member.id;

    // Fetch trip details
    const tripRes = await query('SELECT name, status FROM trips WHERE id = $1', [tripId]);
    if (tripRes.rows.length === 0 || tripRes.rows[0].status === 'done') {
      // Ignore finished trips
      continue;
    }
    const tripName = tripRes.rows[0].name;

    // Fetch all expenses in this trip
    const expensesRes = await query('SELECT * FROM expenses WHERE trip_id = $1 AND source = \'manual\'', [tripId]);
    const expenses = expensesRes.rows;
    if (expenses.length === 0) continue;

    // Fetch splits
    const splitsRes = await query(
      `SELECT * FROM splits 
       WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = $1 AND source = \'manual\')`,
      [tripId]
    );
    const splits = splitsRes.rows;

    // Calculate this member's balance: Paid - Owed
    let balance = 0;

    expenses.forEach((exp) => {
      const amount = Number(exp.amount);
      const paidBy = exp.paid_by;

      // Add to balance if paid by this user
      if (paidBy === memberId) {
        balance += amount;
      }

      const expSplits = splits.filter((s) => s.expense_id === exp.id);
      if (expSplits.length === 0) return;

      if (exp.split_type === 'equal') {
        const share = amount / expSplits.length;
        const inSplit = expSplits.some((s) => s.member_id === memberId);
        if (inSplit) {
          balance -= share;
        }
      } else if (exp.split_type === 'shares') {
        const totalShares = expSplits.reduce((acc, s) => acc + Number(s.weight || 1), 0);
        const userSplit = expSplits.find((s) => s.member_id === memberId);
        if (userSplit && totalShares > 0) {
          const share = (amount * Number(userSplit.weight || 1)) / totalShares;
          balance -= share;
        }
      } else if (exp.split_type === 'exact') {
        const userSplit = expSplits.find((s) => s.member_id === memberId);
        if (userSplit) {
          balance -= Number(userSplit.exact_amount || 0);
        }
      }
    });

    const rounded = Math.round(balance * 100) / 100;
    if (Math.abs(rounded) > 1.0) {
      unsettledTrips.push({ tripName, balance: rounded });
    }
  }

  return unsettledTrips;
}

export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { action } = body;
    
    const user = await getCurrentUser(true);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (action === 'precheck') {
      const unsettled = await checkUnsettledBalances(user.id, user.auth_id);
      if (unsettled.length > 0) {
        return NextResponse.json({
          hasUnsettledBalances: true,
          unsettledTrips: unsettled,
          warning: `You have unsettled balances in: ${unsettled.map(t => `${t.tripName} (${t.balance > 0 ? '+' : ''}₹${t.balance.toFixed(2)})`).join(', ')}. Please settle them before deleting.`
        });
      }
      return NextResponse.json({ hasUnsettledBalances: false });
    }

    if (action === 'delete') {
      console.log(`Starting account deletion for user_id = ${user.id}...`);

      // 1. Anonymize all members in pg: Set name='Former member', clear upi_id and auth_id and user_id, set status='out'
      await query(
        `UPDATE members 
         SET name = 'Former member', 
             upi_id = NULL, 
             auth_id = NULL, 
             user_id = NULL,
             status = 'out' 
         WHERE user_id = $1 OR auth_id = $2`,
        [user.id, user.auth_id]
      );

      // 2. Delete user profile record
      await query('DELETE FROM users WHERE id = $1', [user.id]);

      console.log('Account deleted/anonymized successfully.');
      return NextResponse.json({ success: true, message: 'Account deleted and personal info erased.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error during account deletion:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
