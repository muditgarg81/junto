# Junto — Versatile Checklist (Build Brief)

> **For the Antigravity agent:** Three enhancements to the Essentials checklist: (1) reuse a checklist from a previous trip, (2) AI auto-adds items from chat cues and assigns them to the named person, (3) show the responsible person on each item. Same stack/tokens/guardrails. The chat-detection prompt is in §2.

## Data model

```typescript
ChecklistItem {
  id; trip_id; label;
  category: 'personal' | 'shared_gear';
  assigned_to?;                 // member_id responsible (the "Mine"/assignee link)
  done: boolean;
  source: 'manual' | 'ai_chat' | 'imported';
  imported_from_trip_id?;       // provenance when imported
  created_at;
}
```

`assigned_to` already drives the "Mine" filter; we now also render it (§3) and let the AI set it (§2).

## 1. Reuse a checklist from a previous trip

- On a new/empty checklist (and via a header action), show **"Start from a previous trip →"**.
- Tapping it opens a picker of the **current user's past trips** (their memberships where the trip has a checklist).
- Importing copies the selected trip's item **labels + categories** into this trip with `source='imported'` and `imported_from_trip_id` set; **reset `done=false` and clear `assigned_to`** (different group — items get reassigned here).
- De-dupe against items already present.

## 2. AI auto-adds items from chat cues

The orchestrator (core §8) already evaluates each message; add a **`checklist_assignment`** detection. When a message clearly assigns a packing/gear responsibility to a person ("Vriti please bring the bluetooth speaker", "Karan can you get sunscreen"), create a `ChecklistItem` with `source='ai_chat'`, `category='shared_gear'` (or personal if clearly personal), and `assigned_to` resolved to that member — then **notify the assignee** and mark the item as AI-added (undoable).

Guardrails: be conservative (only on a clear who + what), never on negations or hypotheticals; if the name can't be confidently resolved to a trip member, add the item **unassigned** rather than guess; AI-added items are clearly tagged and one-tap removable by anyone.

**Detection prompt (add to the orchestrator's evaluation; emit in its JSON output):**
```
Also detect packing/gear ASSIGNMENTS in the message: someone asking a specific person to
bring or be responsible for an item (e.g. "Vriti please bring the speaker", "Karan can you
get the first-aid kit"). 

Rules:
- Only fire when there is a clear WHO + WHAT. Ignore vague mentions, questions without an
  assignee, negations ("not bringing"), and hypotheticals.
- Resolve the person to a member of this trip from the provided roster. If you cannot match
  confidently, set assigneeMemberId = null (the item will be added unassigned).
- Classify category as 'shared_gear' (group item) or 'personal'.

Add to your JSON output:
"checklistItem": { "label": "...", "assigneeMemberId": "<id|null>", "category": "shared_gear|personal" } | null
```

The orchestrator then creates the item (`source='ai_chat'`) and posts a brief notice ("Added 'bluetooth speaker' to Vriti's list — tap to undo").

## 3. Show the responsible person on each item

- In the **EVERYONE** and **SHARED GEAR** views, each item row shows an **assignee chip** (avatar + first name) on the right.
- Unassigned items show a muted **"Assign"** chip; tapping it opens a member picker to set `assigned_to`.
- **MINE** continues to filter to `assigned_to = current member`.

### Stitch prompt — updated Essentials screen
> Using the established design system, update the **Essentials checklist** screen. Keep the header "Essentials / Packing checklist for the group", the packing-progress bar, the EVERYONE / MINE / SHARED GEAR segmented filter, the AI RECOMMENDATION card, and the floating + button. Add, at the top of an empty list, a subtle card "Start from a previous trip →" that opens a picker of the user's past trips to import their checklist. Each item row: a circular checkbox, the label, and — in EVERYONE and SHARED GEAR — a small **assignee chip on the right** (avatar + first name, e.g. "Vriti"); unassigned items show a muted "Assign" chip. Items the AI added from chat show a small sparkle "AI" tag with a quiet "from chat" note and are easy to remove.

## Acceptance criteria

1. A new/empty checklist offers "Start from a previous trip"; picking one imports its labels + categories with `done` reset and assignees cleared, de-duped.
2. A message like "Vriti please bring the bluetooth speaker" auto-adds "bluetooth speaker" assigned to Vriti (`source='ai_chat'`), notifies her, and is one-tap removable.
3. If the AI can't confidently match the name to a member, the item is added **unassigned**, not mis-assigned; negations/hypotheticals add nothing.
4. EVERYONE and SHARED GEAR items show the responsible person's name/avatar; unassigned items show an "Assign" affordance that sets `assigned_to`.
5. MINE shows only items assigned to the current member.
