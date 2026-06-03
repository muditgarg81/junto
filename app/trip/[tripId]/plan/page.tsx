'use strict';

import React from 'react';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import PlanClient from './PlanClient';
import { authorizeTripAccess } from '@/lib/authz';
import { Trip, Member, Decision, Option, Vote, Expense, Split, VaultItem, ItineraryItem, ChecklistItem, TripState } from '@/lib/types';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function PlanPage({ params }: PageProps) {
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

  // 3. Fetch Decisions
  const decisionsRes = await query(
    'SELECT * FROM decisions WHERE trip_id = $1 ORDER BY created_at DESC',
    [tripId]
  );
  const decisions = decisionsRes.rows;

  // 4. Fetch Options for all decisions
  const optionsRes = await query(
    `SELECT * FROM options 
     WHERE decision_id IN (SELECT id FROM decisions WHERE trip_id = $1)
     ORDER BY created_at ASC`,
    [tripId]
  );
  const options: Option[] = optionsRes.rows;

  // 5. Fetch Votes for all options
  const votesRes = await query(
    `SELECT * FROM votes 
     WHERE decision_id IN (SELECT id FROM decisions WHERE trip_id = $1)
     ORDER BY created_at ASC`,
    [tripId]
  );
  const votes: Vote[] = votesRes.rows;

  // Assemble decisions with options and votes
  const assembledDecisions = decisions.map((dec) => {
    const decOptions = options.filter((opt) => opt.decision_id === dec.id);
    const decVotes = votes.filter((v) => v.decision_id === dec.id);
    return {
      ...dec,
      options: decOptions,
      votes: decVotes,
    };
  });

  // 6. Fetch Expenses
  const expensesRes = await query(
    'SELECT * FROM expenses WHERE trip_id = $1 ORDER BY date DESC, created_at DESC',
    [tripId]
  );
  const expenses = expensesRes.rows;

  // 7. Fetch Splits
  const splitsRes = await query(
    `SELECT * FROM splits 
     WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = $1)
     ORDER BY created_at ASC`,
    [tripId]
  );
  const splits: Split[] = splitsRes.rows;

  const assembledExpenses = expenses.map((exp) => {
    const expSplits = splits.filter((s) => s.expense_id === exp.id);
    return {
      ...exp,
      splits: expSplits,
    };
  });

  // 8. Fetch Vault Items
  const vaultItemsRes = await query(
    'SELECT * FROM vault_items WHERE trip_id = $1 ORDER BY created_at DESC',
    [tripId]
  );
  const vaultItems: VaultItem[] = vaultItemsRes.rows;

  // 9. Fetch Itinerary Items
  const itineraryItemsRes = await query(
    'SELECT * FROM itinerary_items WHERE trip_id = $1 ORDER BY date ASC, time ASC',
    [tripId]
  );
  const itineraryItems: ItineraryItem[] = itineraryItemsRes.rows;

  // 10. Fetch Checklist Items
  const checklistItemsRes = await query(
    'SELECT * FROM checklist_items WHERE trip_id = $1 ORDER BY created_at ASC',
    [tripId]
  );
  const checklistItems: ChecklistItem[] = checklistItemsRes.rows;

  // 10.5 Fetch Messages
  const messagesRes = await query(
    'SELECT * FROM messages WHERE trip_id = $1 ORDER BY created_at ASC',
    [tripId]
  );
  const messages = messagesRes.rows;

  // 10.6 Fetch Offers
  const offersRes = await query(
    "SELECT * FROM offers WHERE trip_id = $1 AND status != 'dismissed' ORDER BY created_at DESC",
    [tripId]
  );
  const offers = offersRes.rows;

  // 10.7 Check if Boost is active
  const upgradesRes = await query(
    "SELECT 1 FROM trip_upgrades WHERE trip_id = $1 AND status = 'active' LIMIT 1",
    [tripId]
  );
  const isBoosted = upgradesRes.rows.length > 0;

  // Assemble initial TripState
  const initialState: TripState = {
    trip,
    members,
    messages,
    decisions: assembledDecisions as any,
    expenses: assembledExpenses as any,
    vaultItems,
    itineraryItems,
    checklistItems,
    offers,
    isBoosted,
  };

  // 11. Resolve current member context from authorized DB session
  const currentMember = {
    memberId: authMember.id,
    memberName: authMember.name || authUser.name,
    role: authMember.roles.includes('organizer') ? 'organizer' : 'member',
    photoUrl: authUser.photo_url || null,
  };

  return (
    <PlanClient
      initialState={initialState}
      currentMember={currentMember}
    />
  );
}
