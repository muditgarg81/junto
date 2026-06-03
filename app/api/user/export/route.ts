import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(true);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 1. Fetch user profile
    const userProfile = user;

    // 2. Fetch associated member records
    const membersRes = await query('SELECT * FROM members WHERE user_id = $1 OR auth_id = $2', [user.id, user.auth_id]);
    const memberIds = membersRes.rows.map(m => m.id);

    // 3. Fetch associated trips
    let trips: any[] = [];
    if (memberIds.length > 0) {
      const tripsRes = await query(
        `SELECT DISTINCT t.* FROM trips t
         JOIN members m ON t.id = m.trip_id
         WHERE m.user_id = $1 OR m.auth_id = $2`,
        [user.id, user.auth_id]
      );
      trips = tripsRes.rows;
    }

    // 4. Fetch expenses paid by this user
    let expenses: any[] = [];
    if (memberIds.length > 0) {
      const expensesRes = await query(
        `SELECT * FROM expenses WHERE paid_by = ANY($1::uuid[])`,
        [memberIds]
      );
      expenses = expensesRes.rows;
    }

    // 5. Fetch splits for this user
    let splits: any[] = [];
    if (memberIds.length > 0) {
      const splitsRes = await query(
        `SELECT * FROM splits WHERE member_id = ANY($1::uuid[])`,
        [memberIds]
      );
      splits = splitsRes.rows;
    }

    // 6. Fetch messages sent by this user
    let messages: any[] = [];
    if (memberIds.length > 0) {
      const messagesRes = await query(
        `SELECT * FROM messages WHERE author_id = ANY($1::uuid[])`,
        [memberIds]
      );
      messages = messagesRes.rows;
    }

    // Assemble the complete data export
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        upiId: userProfile.upi_id,
        homeCurrency: userProfile.home_currency,
        chatPrefs: userProfile.chat_prefs,
        createdAt: userProfile.created_at
      },
      memberships: membersRes.rows.map(m => ({
        id: m.id,
        tripId: m.trip_id,
        roles: m.roles,
        status: m.status
      })),
      trips: trips.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        baseCurrency: t.base_currency
      })),
      expensesPaid: expenses.map(e => ({
        id: e.id,
        tripId: e.trip_id,
        amount: e.amount,
        currency: e.currency,
        description: e.description,
        category: e.category,
        date: e.date
      })),
      expenseSplits: splits.map(s => ({
        id: s.id,
        expenseId: s.expense_id,
        weight: s.weight,
        exactAmount: s.exact_amount
      })),
      messagesSent: messages.map(m => ({
        id: m.id,
        tripId: m.trip_id,
        body: m.body,
        isAi: m.is_ai,
        createdAt: m.created_at
      }))
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="junto_user_data_export.json"'
      }
    });
  } catch (err: any) {
    console.error('Error generating data export:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
