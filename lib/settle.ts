'use strict';

import { Member, Expense, Split } from './types';

export interface Transfer {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  toUpiId?: string | null;
  amount: number;
}

export function calculateSettleUp(
  members: Member[],
  expenses: (Expense & { splits: Split[] })[]
): Transfer[] {
  // 1. Initialize balances record
  const balances: Record<string, number> = {};
  members.forEach((m) => {
    balances[m.id] = 0;
  });

  // 2. Iterate expenses to calculate net balance per member (paid - owed)
  expenses.forEach((exp) => {
    // Only tally manual/confirmed expenses (exclude unconfirmed AI drafts)
    if (exp.source === 'ai-draft') return;

    const amount = Number(exp.amount);
    const paidBy = exp.paid_by;

    // Credit the payer
    if (balances[paidBy] !== undefined) {
      balances[paidBy] += amount;
    }

    const expSplits = exp.splits;
    if (expSplits.length === 0) return;

    // Debit the members who participate in this expense split
    if (exp.split_type === 'equal') {
      const share = amount / expSplits.length;
      expSplits.forEach((s) => {
        if (balances[s.member_id] !== undefined) {
          balances[s.member_id] -= share;
        }
      });
    } else if (exp.split_type === 'shares') {
      const totalShares = expSplits.reduce((acc, s) => acc + Number(s.weight || 1), 0);
      if (totalShares > 0) {
        expSplits.forEach((s) => {
          const share = (amount * Number(s.weight || 1)) / totalShares;
          if (balances[s.member_id] !== undefined) {
            balances[s.member_id] -= share;
          }
        });
      }
    } else if (exp.split_type === 'exact') {
      expSplits.forEach((s) => {
        const exact = Number(s.exact_amount || 0);
        if (balances[s.member_id] !== undefined) {
          balances[s.member_id] -= exact;
        }
      });
    }
  });

  // 3. Separate creditors (positive balances) and debtors (negative balances)
  const creditors: { id: string; name: string; amount: number; upiId?: string | null }[] = [];
  const debtors: { id: string; name: string; amount: number }[] = [];

  members.forEach((m) => {
    const bal = balances[m.id] || 0;
    // Round to 2 decimal places to prevent float precision bugs
    const roundedBal = Math.round(bal * 100) / 100;

    if (roundedBal > 0.01) {
      creditors.push({ id: m.id, name: m.name || 'Guest', amount: roundedBal, upiId: m.upi_id });
    } else if (roundedBal < -0.01) {
      debtors.push({ id: m.id, name: m.name || 'Guest', amount: Math.abs(roundedBal) });
    }
  });

  // Sort descending
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];

  // 4. Greedy match min-transfer settlement
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const c = creditors[cIdx];
    const d = debtors[dIdx];

    const amt = Math.min(c.amount, d.amount);

    if (amt > 0.01) {
      transfers.push({
        fromMemberId: d.id,
        fromName: d.name,
        toMemberId: c.id,
        toName: c.name,
        toUpiId: c.upiId,
        amount: Math.round(amt * 100) / 100,
      });
    }

    c.amount -= amt;
    d.amount -= amt;

    if (c.amount < 0.01) cIdx++;
    if (d.amount < 0.01) dIdx++;
  }

  return transfers;
}
