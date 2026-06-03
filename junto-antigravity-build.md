# Junto — Antigravity Build Brief

> **For the Antigravity agent:** This is your task spec. Build the app described below end-to-end. Place this file at the repo root as `AGENTS.md` so it stays in context. Work milestone by milestone (§11); after each, run the app, verify against the acceptance criteria (§12), and self-correct before moving on. The product is named **Junto**; define it as one constant (`APP_NAME = "Junto"`) and reference that constant everywhere rather than hardcoding the string. (The design-reference asset folders are still named "wandertogether" — that's the source zip's name; leave those paths as-is, they're just references.)

---

## 1. What we're building

A mobile-first web app that turns the messy group chat of planning a trip into one always-current shared plan. Friends chat as normal; an AI quietly maintains a structured **trip state** (who's in, dates, destination, hotel, budget), turns emerging agreement into trackable **proposals**, tracks **expenses** with one-tap settle-up, and reads uploaded **booking vouchers** into an itinerary. The AI's defining behavior: **it proposes, checks, tallies, and records — humans always decide.**

## 2. Assets provided

Unzip `stitch_tripmate_travel_companion.zip` into `/design-reference/` in the repo. It contains, per screen, a `code.html` (static Tailwind markup — visual reference only, **do not** ship as-is) and a `screen.png` (open these to see the intended design). Use `wandertogether/DESIGN.md` as the **source of truth for design tokens**.

Screens present (light / `_dark` / `_desktop` variants exist for several):
`welcome`, `the_plan`, `chat_lane`, `money`, `add_expense`, `vault`, `confirm_details`, `itinerary`, `essentials_checklist`, `local_info`, plus post-trip extras `photo_gallery`, `digital_yearbook`, `memories`.

Rebuild each as a real React component using the tokens — don't copy the raw HTML. Match the `screen.png` closely.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR + API routes in one codebase; web-first gives link-based guest join with no install |
| Styling | **Tailwind CSS** | Stitch output is already Tailwind; port the `tailwind.config` from DESIGN.md |
| Backend | **Supabase** (Postgres + Realtime + Auth + Storage) | Buy don't build: realtime sync, magic-link auth, and file storage out of the box |
| AI | Server-side **LLM service module** (`lib/llm.ts`) | One `complete()` / `completeVision()` interface; provider + model from env so it's swappable |
| Payments | **UPI deep links** only | Generate `upi://pay?...` intents; never custody funds |

Set model strings from env (`LLM_MODEL`, `LLM_VISION_MODEL`) — use your provider's current long-context, vision-capable models; do not hardcode a version that may be stale.

## 4. Project structure

```
/app
  /(marketing)/page.tsx           → welcome
  /trip/[tripId]/chat/page.tsx    → chat lane (default trip screen)
  /trip/[tripId]/plan/page.tsx    → the plan
  /trip/[tripId]/money/page.tsx   → money + add-expense modal
  /trip/[tripId]/vault/page.tsx   → vault + confirm-details flow
  /trip/[tripId]/itinerary/page.tsx
  /join/[inviteToken]/page.tsx    → guest join
  /api/trip/[tripId]/message/route.ts      → POST a chat message (triggers AI)
  /api/trip/[tripId]/proposal/route.ts     → create / vote / lock
  /api/trip/[tripId]/expense/route.ts      → add expense, compute settle-up
  /api/trip/[tripId]/voucher/route.ts      → upload + AI vision extraction
/lib
  llm.ts            → complete(), completeVision()
  ai-orchestrator.ts→ the chat/AI brain (see §8)
  tripState.ts      → assemble + mutate the trip-state object
  settle.ts         → greedy settle-up
  supabase.ts
/components          → Bubble, AiCard, ProposalCard, BalanceRow, SettleCard, BottomNav, …
/design-reference    → unzipped Stitch bundle
```

## 5. Design system

Port `wandertogether/DESIGN.md` into `tailwind.config.ts`. Key tokens: surface `#fff9ed`, ink `#1d1c14`, primary/pine `#1f4d3f`, secondary/terracotta `#a04018`, AI sage tint `#E8F0EA`, card cream `#FCFAF4`. Fonts: **Fraunces** (display/headings, big numbers), **Hanken Grotesk** (body/UI), Material Symbols for icons. Support light + dark via `darkMode: "class"` (both variants are in the assets). Tabular numerals for all money.

## 6. Data model (Postgres / TypeScript)

The one decision that simplifies everything: **an open question and a locked decision are the same `Decision` row in different states.**

```typescript
Trip          { id; name; status:'planning'|'active'|'done'; base_currency; invite_token; }
Member        { id; trip_id; name; status:'invited'|'confirmed'|'maybe'|'out'; roles:string[]; auth_id?; }
Message       { id; trip_id; author_id|null; is_ai:boolean; body; created_at; }  // author_id null + is_ai = AI
Decision      { id; trip_id; type:'dates'|'destination'|'hotel'|'budget'|'logistics'|'custom';
                title; status:'open'|'locked'|'rejected'; resolved_option_id?; created_from_message_id?; }
Option        { id; decision_id; label; payload jsonb; proposed_by; }
Vote          { id; decision_id; option_id; member_id; value:'yes'|'no'|'abstain'; }
Expense       { id; trip_id; paid_by; amount; currency; fx_rate;            // rate captured AT ENTRY
                description; category; date; split_type:'equal'|'shares'|'exact'; source:'manual'|'ai-draft'; }
Split         { id; expense_id; member_id; weight?; exact_amount?; }
VaultItem     { id; trip_id; kind; doc_type?; source_file_url; fields jsonb; }
ItineraryItem { id; trip_id; date; time?; type; title; location?; source_vault_item_id?; }
ChecklistItem { id; trip_id; label; category; assigned_to?; per_person; done; }
```

Enable Supabase Realtime on `messages`, `decisions`, `votes`, `expenses` so all clients update live.

---

## 8. Chat + AI integration — THE CORE (build this carefully)

This is the heart of the product. The model is **hub-and-spoke with a shared board**: members post to one chat feed; the AI is a *member* that observes and occasionally speaks — it is **never in the synchronous send path**. Messages post instantly; the AI evaluates asynchronously after each human message.

### 8.1 Message flow

```
POST /api/trip/:id/message
  1. Insert Message (author_id = sender, is_ai = false)  → returns immediately, client renders via Realtime
  2. Fire-and-forget: enqueue runAiOrchestrator(tripId, newMessageId)
```

`runAiOrchestrator` (in `lib/ai-orchestrator.ts`):

```
1. Load trip state: roster, open + locked Decisions, recent 20 messages, current balances.
2. Build the LLM context (system prompt §8.3 + serialized state + recent messages).
3. Call llm.complete() requesting STRICT JSON (schema §8.4).
4. Parse. Then act:
     - intervene=false → do nothing (the common case; AI stays quiet, no message posted).
     - trigger='mention'           → insert AI Message (body = message).
     - trigger='conflict'          → insert AI Message flagging it (non-blocking).
     - trigger='emerging_decision' → insert AI Message offering to formalize + attach proposalDraft
                                      so the client shows a "Make it a proposal" button.
     - trigger='expense'           → create Expense with source='ai-draft' (UNCONFIRMED) +
                                      insert AI Message asking the payer to confirm.
     - stateUpdates[]              → apply silent roster/status updates (no message).
```

### 8.2 Cost + latency discipline (required)

- The AI must **default to silence**. Most messages produce `intervene:false` and cost one cheap call.
- Cheap pre-filter before calling the LLM: skip orchestration for trivial messages (reactions, <3 words like "haha", "ok", emoji-only) unless they contain an `@ai` mention.
- Never block message delivery on the AI. Never call the LLM more than once per inbound human message.
- Batch background reconciliation if multiple messages arrive within a few seconds.

### 8.3 System prompt (use verbatim as the base)

```
You are the trip assistant inside a group travel-planning app. A group of friends is
planning a trip together in a shared chat. You are a quiet, helpful member of that chat —
NOT a chatbot they are talking to.

YOUR JOB: keep the trip's structured state accurate and help the group reach and record
decisions. You PROPOSE, CHECK, TALLY, and RECORD. You NEVER decide for the group and you
NEVER cast a vote.

DEFAULT TO SILENCE. Most messages need no response from you. Only speak when one of these
THREE triggers fires:
  1. MENTION  — someone directly addresses you (e.g. "@ai", "hey assistant").
  2. CONFLICT — a message contradicts something the group has already LOCKED (not merely
                discussed). Flag it briefly and non-blockingly. Never flag a disagreement
                between people as a conflict — disagreement is normal, not an error.
  3. EMERGING_DECISION — the conversation has clearly converged on a date, destination,
                hotel, budget, or plan item that is not yet a locked decision. Offer to turn
                it into a proposal. Do not pre-decide which option wins.
Also detect EXPENSE mentions ("I paid 4000 for the cab, split me/Vriti/Aditi") and prepare
a DRAFT expense for the payer to confirm — never log money automatically.

HARD RULES:
- You speak only as yourself. Never rewrite a person's words or attribute words to them.
- You never change a decision's status; decisions only change through the group's voting.
- Money and dates are sensitive: always produce DRAFTS for humans to confirm, never commits.
- Keep any message you do post short, warm, and concrete.

OUTPUT: respond with ONLY a JSON object matching the provided schema. No prose outside JSON.
```

### 8.4 Structured output schema (the AI returns exactly this)

```jsonc
{
  "intervene": false,                       // default; true only on a trigger
  "trigger": "none",                        // none | mention | conflict | emerging_decision | expense
  "message": null,                          // string shown to the group (AI speaks as itself)
  "proposalDraft": null,                    // { "type": "...", "title": "...", "options": [{ "label": "...", "payload": {} }] }
  "conflict": null,                         // { "lockedDecisionId": "...", "explanation": "..." }
  "expenseDraft": null,                     // { "amount": 0, "currency": "INR", "description": "", "paidBy": "<memberId>", "splitWith": ["<memberId>"] }
  "stateUpdates": []                        // e.g. [{ "memberId": "...", "status": "confirmed" }]
}
```

Validate with a schema (zod) and reject/repair malformed output before acting.

### 8.5 Proposal lifecycle (the structured lane)

`POST /api/trip/:id/proposal` handles create / vote / lock. On create, run a one-shot AI **sanity check** (does this conflict with locked state?) — non-blocking, attach the note to the proposal. During voting, the AI tallies and can nudge non-responders. On consensus, set `status='locked'`, set `resolved_option_id`, and insert a clean AI record message (e.g. `✓ Dates locked: Jan 15–20`). A rejected proposal returns to chat as an open question.

### 8.6 Voucher extraction (vision)

`POST /api/trip/:id/voucher`: store the file in Supabase Storage, call `llm.completeVision()` with the image/PDF and a type-keyed extraction prompt (flight → airline/flight no./times/PNR; hotel → name/dates/conf no.; etc.). Return fields to the **confirm_details** screen for human verification. **Flag any ambiguous date** (`05/06/2026` is DD/MM in India, MM/DD in the US) with a warning and require confirmation before committing. On confirm, write a `VaultItem` and generate linked `ItineraryItem`s, then run the same conflict check against the itinerary.

---

## 9. Money logic (`lib/settle.ts`)

Split modes: `equal` (only checked members), `shares` (weighted), `exact`. Capture `fx_rate` at entry time; never convert live. Distribute rounding remainder deterministically so balances sum to zero. Settle-up uses greedy min-transfer:

```
balances = paid − owed per member            // sums to 0
creditors = max-heap of positive balances
debtors   = max-heap of |negative| balances
while both non-empty:
  c, d = largest of each
  amt = min(c, d); record transfer d → c of amt
  decrement both; drop whoever hits ~0
```

Each resulting transfer renders a one-tap UPI link (`upi://pay?pa=<vpa>&pn=<name>&am=<amt>&cu=INR`) plus a manual "mark settled" fallback.

## 10. Realtime & auth

Supabase Realtime channels per trip for `messages`/`decisions`/`votes`/`expenses`. Auth: magic-link for organizers; **guests join via `/join/[inviteToken]` with just a display name** (lightweight identity, no password) so participation needs no install.

## 11. Build milestones (do in order; run + verify after each)

- **M0 — Scaffold.** Next.js + Tailwind (tokens from DESIGN.md) + Supabase + schema migrations + `welcome` screen.
- **M1 — Rails.** Create trip → invite link → join. Manual proposals (create/vote/live tally/lock) → `the_plan` updates. Realtime working. *(No AI yet — proves the core loop.)*
- **M2 — Chat + AI (the core, §8).** Chat feed, AI orchestrator, system prompt, structured output, the three triggers, the "make it a proposal" seam. This is the differentiator — budget the most time here and iterate with real example chats.
- **M3 — Money.** `add_expense` (split modes), balances, greedy settle-up, UPI links, AI expense drafting from chat.
- **M4 — Vault & itinerary.** Upload → vision extraction → `confirm_details` (date-verify) → vault → itinerary timeline + conflict flags.
- **M5 — Extras.** `essentials_checklist`, `local_info`, post-trip `photo_gallery` / `digital_yearbook`. Dark mode polish.

> If validating the concept first, build the **Strategy-B magic demo** as M1-alt: a single screen where pasted chat → AI returns a structured plan (no persistence/auth/money). Confirms the AI extraction is good enough before investing in rails.

## 12. Acceptance criteria

- A trip can be created, shared by link, and joined by a guest with no install.
- Posting in chat renders instantly for all members (Realtime), with the AI staying silent on trivial messages.
- When the group converges on a date in chat, the AI offers to formalize it; accepting creates a proposal that can be voted and locked, and the plan reflects it.
- "I paid X for Y, split A/B" produces a *draft* expense the payer confirms; settle-up shows the minimum transfers with working UPI links.
- Uploading a hotel voucher extracts fields, flags an ambiguous date for confirmation, and adds a linked itinerary entry.
- Every screen matches its `screen.png` and uses the design tokens; light + dark both render.

## 13. Guardrails (enforce as engineering constraints)

1. AI proposes, humans decide — no auto-commit of decisions, expenses, or dates.
2. The AI never rewrites or re-attributes a person's words; it speaks only as itself.
3. Track money, never hold it.
4. AI is never in the synchronous message-send path; default to silence.
5. Offline-readable vault, itinerary, and local-info (cache them).

## 14. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_API_KEY=
LLM_MODEL=            # long-context text model
LLM_VISION_MODEL=     # vision-capable model for voucher OCR
```
