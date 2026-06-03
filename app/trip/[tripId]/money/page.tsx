'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import MoneyClient from './MoneyClient';
import { Trip, Member, Expense, Split } from '@/lib/types';
import { authorizeTripAccess } from '@/lib/authz';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function MoneyPage({ params }: PageProps) {
  const { tripId } = await params;

  let authUser;
  let authMember;
  try {
    const auth = await authorizeTripAccess(tripId);
    authUser = auth.user;
    authMember = auth.member;
  } catch (err) {
    notFound();
  }

  // 1. Fetch Trip details
  const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (tripRes.rows.length === 0) {
    notFound();
  }
  const trip: Trip = tripRes.rows[0];

  // 2. Fetch Members of the trip
  const membersRes = await query(
    'SELECT * FROM members WHERE trip_id = $1 ORDER BY created_at ASC',
    [tripId]
  );
  const members: Member[] = membersRes.rows;

  // 3. Fetch Expenses
  const expensesRes = await query(
    'SELECT * FROM expenses WHERE trip_id = $1 ORDER BY date DESC, created_at DESC',
    [tripId]
  );
  const expenses = expensesRes.rows;

  // 4. Fetch Splits
  const splitsRes = await query(
    `SELECT * FROM splits 
     WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = $1)
     ORDER BY created_at ASC`,
    [tripId]
  );
  const splits: Split[] = splitsRes.rows;

  // Assemble expenses with splits
  const assembledExpenses = expenses.map((exp) => {
    const expSplits = splits.filter((s) => s.expense_id === exp.id);
    return {
      ...exp,
      splits: expSplits,
    };
  });

  // Fetch locked dates decision
  const datesRes = await query(
    `SELECT o.payload 
     FROM decisions d
     JOIN options o ON d.resolved_option_id = o.id
     WHERE d.trip_id = $1 AND d.type = 'dates' AND d.status = 'locked'
     LIMIT 1`,
    [tripId]
  );
  const datesPayload = datesRes.rows[0]?.payload || null;

  // Fetch locked budget decision
  const budgetRes = await query(
    `SELECT o.label, o.payload 
     FROM decisions d
     JOIN options o ON d.resolved_option_id = o.id
     WHERE d.trip_id = $1 AND d.type = 'budget' AND d.status = 'locked'
     LIMIT 1`,
    [tripId]
  );
  const budgetDecision = budgetRes.rows[0] || null;

  // 5. Resolve current member context from authorized DB session
  const currentMember = {
    memberId: authMember.id,
    memberName: authMember.name || authUser.name,
    role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
    photoUrl: authUser.photo_url || null,
  };

  return (
    <MoneyClient
      trip={trip}
      members={members}
      initialExpenses={assembledExpenses}
      currentMember={currentMember}
      datesPayload={datesPayload}
      budgetDecision={budgetDecision}
    />
  );
}
