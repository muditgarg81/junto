'use strict';

import { query } from '@/lib/db';
import { completeWithUsage } from '@/lib/llm';
import { logAiCallMetrics, getTripMetrics } from './metrics';
import { Trip, Member, Decision, Option, Vote, Message, Expense } from '@/lib/types';

// Pre-filter to skip trivial human messages and reactions
function isTrivialMessage(body: string): boolean {
  const clean = body.trim().toLowerCase();
  
  // If AI is directly mentioned, never skip
  if (clean.includes('@ai') || clean.includes('assistant')) {
    return false;
  }

  // Skip very short messages (< 3 chars)
  if (clean.length < 3) return true;

  // Skip common reactions/agreements
  const commonReactions = [
    'ok', 'okay', 'haha', 'hahaha', 'lol', 'lmao', 'cool', 'nice', 'sure', 
    'yes', 'no', 'yeah', 'yep', 'nope', 'agree', 'perfect', 'awesome', 'great'
  ];
  if (commonReactions.includes(clean)) return true;

  // Skip emoji-only messages
  const emojiRegex = /^[\s\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]+$/;
  const stripped = clean.replace(/[\s\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
  if (stripped.length === 0) return true;

  return false;
}

// Helper to calculate basic user balances to provide context for the AI
async function getSummaryBalances(tripId: string) {
  const expensesRes = await query('SELECT * FROM expenses WHERE trip_id = $1', [tripId]);
  const expenses: Expense[] = expensesRes.rows;

  const splitsRes = await query(
    `SELECT s.* FROM splits s 
     JOIN expenses e ON s.expense_id = e.id 
     WHERE e.trip_id = $1`,
    [tripId]
  );
  const splits = splitsRes.rows;

  const membersRes = await query('SELECT id, name FROM members WHERE trip_id = $1', [tripId]);
  const members = membersRes.rows;

  const balances: Record<string, { name: string; balance: number }> = {};
  members.forEach((m) => {
    balances[m.id] = { name: m.name, balance: 0 };
  });

  expenses.forEach((exp) => {
    const paidBy = exp.paid_by;
    const amount = Number(exp.amount);
    
    // Skip unconfirmed AI drafts in balance tallies
    if (exp.source === 'ai-draft') return;

    if (balances[paidBy]) {
      balances[paidBy].balance += amount;
    }

    const expSplits = splits.filter((s) => s.expense_id === exp.id);
    if (expSplits.length === 0) return;

    if (exp.split_type === 'equal') {
      const share = amount / expSplits.length;
      expSplits.forEach((s) => {
        if (balances[s.member_id]) {
          balances[s.member_id].balance -= share;
        }
      });
    } else {
      // Basic fallback split handling
      const share = amount / expSplits.length;
      expSplits.forEach((s) => {
        if (balances[s.member_id]) {
          balances[s.member_id].balance -= share;
        }
      });
    }
  });

  return Object.entries(balances).map(([id, val]) => ({
    memberId: id,
    name: val.name,
    balance: Math.round(val.balance * 100) / 100,
  }));
}

/**
 * Main AI Orchestrator observer
 */
export async function runAiOrchestrator(tripId: string, newMessageId: string) {
  try {
    // Check AI LLM spend cap (₹50.00 INR limit)
    const metrics = await getTripMetrics(tripId);
    const TRIP_LLM_SPEND_CAP_INR = 50.0;
    if (metrics.totalAiCost >= TRIP_LLM_SPEND_CAP_INR) {
      console.warn(`AI Orchestrator: Trip ${tripId} has exceeded LLM spend cap of ₹${TRIP_LLM_SPEND_CAP_INR}. Current cost: ₹${metrics.totalAiCost}`);
      
      // Post system warning message in chat
      const aiWarningMessageId = crypto.randomUUID();
      await query(
        `INSERT INTO messages (id, trip_id, author_id, is_ai, body, metadata)
         VALUES ($1, $2, null, true, $3, $4)`,
        [
          aiWarningMessageId,
          tripId,
          `⚠️ AI planning functions are paused: trip spend cap of ₹${TRIP_LLM_SPEND_CAP_INR.toFixed(2)} exceeded.`,
          JSON.stringify({ trigger: 'spend_cap_exceeded' })
        ]
      );
      return;
    }

    // 1. Load the new message
    const messageRes = await query('SELECT * FROM messages WHERE id = $1', [newMessageId]);
    if (messageRes.rows.length === 0) return;
    const newMessage = messageRes.rows[0];

    // Skip if it is an AI message
    if (newMessage.is_ai) return;

    // Apply pre-filter
    if (isTrivialMessage(newMessage.body)) {
      console.log(`AI Orchestrator: Skipping trivial message "${newMessage.body}"`);
      return;
    }

    console.log(`AI Orchestrator: Processing message "${newMessage.body}"`);

    // 2. Fetch Trip State
    const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripRes.rows.length === 0) return;
    const trip = tripRes.rows[0];

    const membersRes = await query('SELECT * FROM members WHERE trip_id = $1', [tripId]);
    const members: Member[] = membersRes.rows;

    const decisionsRes = await query('SELECT * FROM decisions WHERE trip_id = $1', [tripId]);
    const decisions: Decision[] = decisionsRes.rows;

    const optionsRes = await query(
      `SELECT * FROM options 
       WHERE decision_id IN (SELECT id FROM decisions WHERE trip_id = $1)`,
      [tripId]
    );
    const options: Option[] = optionsRes.rows;

    const messagesRes = await query(
      `SELECT m.*, memb.name as author_name 
       FROM messages m 
       LEFT JOIN members memb ON m.author_id = memb.id 
       WHERE m.trip_id = $1 
       ORDER BY m.created_at DESC LIMIT 20`,
      [tripId]
    );
    const messages = messagesRes.rows.reverse();

    const balances = await getSummaryBalances(tripId);

    // 3. Serialize State for LLM context
    const serializedRoster = members
      .map((m) => `- Member: ${m.name} (ID: ${m.id}, Status: ${m.status}, Roles: ${m.roles.join(', ') || 'none'})`)
      .join('\n');

    const lockedDecisions = decisions.filter((d) => d.status === 'locked');
    const serializedDecided = lockedDecisions
      .map((d) => {
        const opt = options.find((o) => o.id === d.resolved_option_id);
        return `- ${d.type} Locked: ${opt?.label || d.title} (Decision ID: ${d.id})`;
      })
      .join('\n') || 'None';

    const openDecisions = decisions.filter((d) => d.status === 'open');
    const serializedOpen = openDecisions
      .map((d) => {
        const opts = options.filter((o) => o.decision_id === d.id);
        return `- Open Question on ${d.type}: "${d.title}" (Decision ID: ${d.id})\n  Options: ${opts
          .map((o) => `"${o.label}" (Option ID: ${o.id})`)
          .join(', ')}`;
      })
      .join('\n') || 'None';

    const serializedMessages = messages
      .map((m) => {
        const sender = m.is_ai ? 'AI Assistant' : m.author_name || 'Unknown';
        return `[${sender}]: ${m.body}`;
      })
      .join('\n');

    const serializedBalances = balances
      .map((b) => `- ${b.name}: ${b.balance >= 0 ? '+' : ''}${b.balance} INR`)
      .join('\n');

    const userPrompt = `
CURRENT TRIP STATE:
Trip Name: ${trip.name}
Base Currency: ${trip.base_currency}

MEMBER ROSTER:
${serializedRoster}

LOCKED DECISIONS:
${serializedDecided}

OPEN QUESTIONS / PROPOSALS IN DISCUSSION:
${serializedOpen}

CURRENT BALANCES:
${serializedBalances}

RECENT CHAT LOG:
${serializedMessages}

Observe the conversation, update roster status if someone responds to invitations (e.g. "I am in" -> confirm, "I can't make it" -> out), check for locked decisions contradictions (Conflicts), flag converging plans (Emerging Decisions), or log draft expenses (Expenses). Call Gemini API now and return strict JSON output.
`;

    // 4. Custom strict JSON schema
    const jsonSchema = {
      type: 'OBJECT',
      properties: {
        intervene: { type: 'BOOLEAN' },
        trigger: {
          type: 'STRING',
          enum: ['none', 'mention', 'conflict', 'emerging_decision', 'expense', 'checklist_assignment'],
        },
        message: { type: 'STRING' },
        proposalDraft: {
          type: 'OBJECT',
          properties: {
            type: {
              type: 'STRING',
              enum: ['dates', 'destination', 'hotel', 'budget', 'logistics', 'custom'],
            },
            title: { type: 'STRING' },
            options: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING' },
                  payload: { type: 'OBJECT' },
                },
                required: ['label'],
              },
            },
          },
          required: ['type', 'title', 'options'],
        },
        conflict: {
          type: 'OBJECT',
          properties: {
            lockedDecisionId: { type: 'STRING' },
            explanation: { type: 'STRING' },
          },
          required: ['lockedDecisionId', 'explanation'],
        },
        expenseDraft: {
          type: 'OBJECT',
          properties: {
            amount: { type: 'NUMBER' },
            currency: { type: 'STRING' },
            description: { type: 'STRING' },
            paidBy: { type: 'STRING' }, // Member ID or Member Name
            splitWith: {
              type: 'ARRAY',
              items: { type: 'STRING' }, // Member IDs or Member Names
            },
          },
          required: ['amount', 'currency', 'description', 'paidBy', 'splitWith'],
        },
        checklistItem: {
          type: 'OBJECT',
          properties: {
            label: { type: 'STRING' },
            assigneeMemberId: { type: 'STRING' }, // can be null or Member ID/Name
            category: { type: 'STRING', enum: ['shared_gear', 'personal'] }
          },
          required: ['label', 'category']
        },
        stateUpdates: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              memberId: { type: 'STRING' },
              status: { type: 'STRING', enum: ['invited', 'confirmed', 'maybe', 'out'] },
            },
            required: ['memberId', 'status'],
          },
        },
      },
      required: ['intervene', 'trigger'],
    };

    // System prompt verbatim matching brief §8.3
    const systemPrompt = `You are the trip assistant inside a group travel-planning app. A group of friends is
planning a trip together in a shared chat. You are a quiet, helpful member of that chat —
NOT a chatbot they are talking to.

YOUR JOB: keep the trip's structured state accurate and help the group reach and record
decisions. You PROPOSE, CHECK, TALLY, and RECORD. You NEVER decide for the group and you
never cast a vote.

DEFAULT TO SILENCE. Most messages need no response from you. Only speak when one of these
FOUR triggers fires:
  1. MENTION  — someone directly addresses you (e.g. "@ai", "hey assistant").
  2. CONFLICT — a message contradicts something the group has already LOCKED (not merely
                discussed). Flag it briefly and non-blockingly. Never flag a disagreement
                between people as a conflict — disagreement is normal, not an error.
  3. EMERGING_DECISION — the conversation has clearly converged on a date, destination,
                hotel, budget, or plan item that is not yet a locked decision. ALSO trigger this
                if the group discusses changing, revising, or amending an already LOCKED decision
                (e.g., they talk about changing dates when dates are already locked). Offer to turn
                it into a proposal to amend the plan. Do not pre-decide which option wins.
  4. CHECKLIST_ASSIGNMENT — someone clearly assigns packing or gear responsibility to a person 
                (e.g. "Vriti please bring the bluetooth speaker", "Karan can you get sunscreen").

Also detect EXPENSE mentions ("I paid 4000 for the cab, split me/Vriti/Aditi") and prepare
a DRAFT expense for the payer to confirm — never log money automatically.

Also detect packing/gear ASSIGNMENTS in the message: someone asking a specific person to
bring or be responsible for an item (e.g. "Vriti please bring the speaker", "Karan can you
get the first-aid kit"). 

Rules:
- Only fire when there is a clear WHO + WHAT. Ignore vague mentions, questions without an
  assignee, negations ("not bringing"), and hypotheticals.
- Resolve the person to a member of this trip from the provided roster. If you cannot match
  confidently, set assigneeMemberId = null (the item will be added unassigned).
- Classify category as 'shared_gear' (group item) or 'personal'.
- AMENDMENTS: If a user suggests changing or revising an already LOCKED/confirmed plan (e.g., "I want to change travel dates" or "Ok let's do 12th June to 15th June" when dates are already locked), detect this intent and suggest a new proposal to amend that locked decision. Formulate it as trigger 'emerging_decision' and draft a proposalDraft with a title like "Amend [Plan type]: [New Value]" (e.g. "Amend Dates: 12th June to 15th June").

Add to your JSON output:
"checklistItem": { "label": "...", "assigneeMemberId": "<id|null>", "category": "shared_gear|personal" } | null

HARD RULES:
- You speak only as yourself. Never rewrite a person's words or attribute words to them.
- You never change a decision's status; decisions only change through the group's voting.
- Money and dates are sensitive: always produce DRAFTS for humans to confirm, never commits.
- Keep any message you do post short, warm, and concrete.

You may surface partner "booking options" when the offer engine provides them, but:
- Commission NEVER influences your recommendations. Rank options only by genuine fit for the group (price, location, reviews, the group's stated budget and preferences).
- Always keep sponsored/booking options clearly distinct from your own neutral suggestions, and never imply a paid option is your recommendation unless it is genuinely the best fit.
- If asked, disclose plainly that booking options may earn Junto a commission.

OUTPUT: respond with ONLY a JSON object matching the provided schema. No prose outside JSON.`;

    // 5. Call LLM REST API
    const { text: rawResult, inputTokens, outputTokens } = await completeWithUsage(userPrompt, systemPrompt, jsonSchema);
    const result = JSON.parse(rawResult);

    console.log('AI Orchestrator decision output:', result);

    if (!result.intervene) {
      console.log('AI Orchestrator: Defaulted to silence.');
      return;
    }

    // 6. Apply Quiet State Updates
    if (result.stateUpdates && Array.isArray(result.stateUpdates)) {
      for (const update of result.stateUpdates) {
        console.log(`AI Orchestrator: Updating status of member ${update.memberId} to ${update.status}`);
        await query('UPDATE members SET status = $1 WHERE id = $2', [
          update.status,
          update.memberId,
        ]);
      }
    }

    // 7. Process Triggers
    const metadataPayload: any = {
      trigger: result.trigger,
    };

    if (result.trigger === 'emerging_decision' && result.proposalDraft) {
      metadataPayload.proposalDraft = result.proposalDraft;
      
      // Trigger offers for hotel/activity decisions
      try {
        const { triggerOffers } = require('@/lib/offers');
        if (result.proposalDraft.type === 'hotel') {
          triggerOffers(tripId, 'hotel_decision_opened').catch(console.error);
        } else if (result.proposalDraft.type === 'activity') {
          triggerOffers(tripId, 'activity_interest').catch(console.error);
        }
      } catch (err) {
        console.error('Failed to trigger proposal offers:', err);
      }
    }

    if (result.trigger === 'conflict' && result.conflict) {
      metadataPayload.conflict = result.conflict;
    }

    if (result.trigger === 'checklist_assignment' && result.checklistItem) {
      const itemDraft = result.checklistItem;
      const label = itemDraft.label;
      const category = itemDraft.category === 'shared_gear' ? 'shared' : 'personal';
      let assigneeId = itemDraft.assigneeMemberId;
      
      let assigneeName = '';
      let resolvedMember = members.find(m => m.id === assigneeId);
      if (!resolvedMember && assigneeId) {
        resolvedMember = members.find(
          (m) => (m.name || '').toLowerCase() === assigneeId.toLowerCase()
        );
      }
      
      if (resolvedMember) {
        assigneeId = resolvedMember.id;
        assigneeName = resolvedMember.name || 'Friend';
      } else {
        assigneeId = null;
      }

      // Create a checklist item with source='ai_chat'
      const itemId = crypto.randomUUID();
      await query(
        `INSERT INTO checklist_items (id, trip_id, label, category, assigned_to, per_person, done, source)
         VALUES ($1, $2, $3, $4, $5, false, false, 'ai_chat')`,
        [itemId, tripId, label, category, assigneeId]
      );

      const noticeBody = assigneeId
        ? `Added '${label}' to ${assigneeName}'s list.`
        : `Added '${label}' (unassigned).`;

      result.message = noticeBody;

      metadataPayload.trigger = 'checklist_assignment';
      metadataPayload.checklistItem = {
        id: itemId,
        label,
        assigneeMemberId: assigneeId,
        assigneeName: assigneeId ? assigneeName : 'unassigned',
        category
      };
    }

    if (result.trigger === 'expense' && result.expenseDraft) {
      const draft = result.expenseDraft;

      // Resolve PaidBy (can be ID or Name)
      let payerId = draft.paidBy;
      const payerMember = members.find(
        (m) => (m.name || '').toLowerCase() === draft.paidBy.toLowerCase() || m.id === draft.paidBy
      );
      if (payerMember) payerId = payerMember.id;

      // Resolve split members
      const splitMemberIds: string[] = [];
      draft.splitWith.forEach((nameOrId: string) => {
        const match = members.find(
          (m) => (m.name || '').toLowerCase() === nameOrId.toLowerCase() || m.id === nameOrId
        );
        if (match) splitMemberIds.push(match.id);
      });

      if (payerId && splitMemberIds.length > 0) {
        // Create draft unconfirmed expense row
        const expenseId = crypto.randomUUID();
        await query(
          `INSERT INTO expenses (id, trip_id, paid_by, amount, currency, fx_rate, description, category, split_type, source)
           VALUES ($1, $2, $3, $4, $5, 1.0, $6, 'Transport', 'equal', 'ai-draft')`,
          [
            expenseId,
            tripId,
            payerId,
            draft.amount,
            draft.currency || 'INR',
            draft.description || 'Cab/Expense',
          ]
        );

        // Create split rows
        for (const mId of splitMemberIds) {
          await query(
            `INSERT INTO splits (id, expense_id, member_id)
             VALUES ($1, $2, $3)`,
            [crypto.randomUUID(), expenseId, mId]
          );
        }

        // Trigger transport affiliate offers if description mentions cabs/transfer
        try {
          const desc = (draft.description || '').toLowerCase();
          const isCab = desc.includes('cab') || desc.includes('taxi') || desc.includes('uber') || 
                        desc.includes('ride') || desc.includes('transfer') || desc.includes('airport');
          if (isCab) {
            const { triggerOffers } = require('@/lib/offers');
            triggerOffers(tripId, 'transport_expense').catch(console.error);
          }
        } catch (err) {
          console.error('Failed to trigger transport offers:', err);
        }

        // Store draft reference in metadata
        metadataPayload.expenseDraft = {
          ...draft,
          expenseId,
          paidBy: payerId,
          splitWith: splitMemberIds,
        };
      }
    }

    // 8. Insert AI Response message
    if (result.message) {
      console.log('AI Orchestrator speaking:', result.message);
      const aiMessageId = crypto.randomUUID();
      await query(
        `INSERT INTO messages (id, trip_id, author_id, is_ai, body, metadata)
         VALUES ($1, $2, null, true, $3, $4)`,
        [aiMessageId, tripId, result.message, JSON.stringify(metadataPayload)]
      );
      
      // Log token metrics
      await logAiCallMetrics(aiMessageId, inputTokens, outputTokens);
    }
  } catch (err) {
    console.error('AI Orchestrator failed:', err);
  }
}
