# CLAUDE.md — JuntoFun (The Living Trip Plan)

Repo source-of-truth for Claude Code. Read this fully at the start of each session. When you change architecture, schema, or conventions, update this file in the same commit.

---

## 1. Product

JuntoFun is an AI-native, mobile-first app for planning group trips. Friends chat normally; an AI quietly turns the conversation into one shared, always-current plan, then helps with money, bookings, packing, and logistics. India-first (UPI, INR).

**Core AI philosophy (non-negotiable):**
- The AI **proposes, checks, tallies, drafts** — it **never decides for the group, never locks a decision, never commits an expense** automatically. Humans always confirm consequential actions.
- **Default to silence.** Trivial messages ("ok", "lol", emojis, <3 chars) are filtered before any LLM call. The AI speaks only on a defined trigger.
- Free core (chat, voting, expenses, vault, itinerary). Paid **Boost** (group-wide one-time fee) unlocks premium AI (priority OCR, connection flags, enriched suggestions, flight tracking, news).

---

## 2. Stack

- **Frontend:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4. Design tokens in `/design-reference/wandertogether/DESIGN.md` (pine/terracotta/cream palette; Fraunces + Hanken Grotesk).
- **DB:** Neon Serverless Postgres (`lib/db.ts`)
- **AI:** Google Gemini REST (`lib/llm.ts`); models via env `LLM_MODEL` / `LLM_VISION_MODEL` (default `gemini-2.5-flash`)
- **Mobile:** Capacitor (Android). **Architecture resolved:** Capacitor WebView loads the hosted Vercel Next.js app (`https://junto-three.vercel.app`). All client `fetch()` calls use relative paths which resolve to the same origin — no CORS issue. `sameSite: lax` session cookies work because the WebView origin equals the server origin. No `output: 'export'` is used or needed; `webDir: 'out'` in `capacitor.config.ts` is an unused fallback. For local dev: set `CAPACITOR_SERVER_URL=http://<LAN-IP>:3000` before `npm run cap:sync`. For a release build: `npm run android:prod` (opens Android Studio → `bundleRelease`).
- **Payments:** Razorpay (India) / Stripe (global), **hosted checkout only — no card data on our servers.**

---

## 3. Codebase rules & quirks (read before editing)

1. **Timezone-safe dates.** Never `new Date(isoString)` in client components (shifts by browser offset → hydration errors). Parse by components: `const [y,m,d]=s.split('T')[0].split('-').map(Number); new Date(y,m-1,d)`.
2. **UUIDs in insecure contexts.** `crypto.randomUUID()` fails over plain-HTTP LAN IPs. Use `generateUUID` from `@/lib/uuid` for optimistic UI. Client UUIDs are never trusted as authoritative — the server validates/assigns.
3. **Hydration.** Root `<html>` in `app/layout.tsx` keeps `suppressHydrationWarning` (mobile injects safe-area styles).
4. **Serverless background work.** Non-awaited promises get killed in serverless. Wrap background work (the AI orchestrator) in Next.js `after()`. **The proactive concierge is a separate cron job — never run LLM/concierge work inside `/sync`.**
5. **`/sync` is read-only and hot** (polled ~3s). It must make **zero** LLM calls and must be cheap.

---

## 4. Data model

Full DDL in `db/schema.sql`. Tables: `users`, `user_sessions` (revocable), `trips` (+`boost_status`), `members`, `messages`, `decisions`, `options`, `votes`, `expenses`, `splits`, `vault_items`, `itinerary_items` (has `starts_at`/`ends_at`/`tz` — use these for all time math, not the legacy `date`/`time`), `checklist_items`, `offers`, `partners`. A proposal and a locked choice are the same `decisions` row in different states. `members.auth_id`/`upi_id` are legacy — identity resolves from the session→`users`.

---

## 5. Core mechanics

**Orchestrator (`lib/ai-orchestrator.ts`)** — runs via `after()` on each non-trivial message. Low temp (0.1), defaults to silence, emits a strict JSON object validated against a schema before any DB write. Triggers: `mention`, `conflict` (contradicts a locked decision), `emerging_decision` (→ draft proposal, human confirms), `checklist_assignment` (resolve name→member), `expense` (→ draft, payer confirms). **Plus the concierge intents (§6).**

**Concierge (§6)** — reactive intents + a scheduled proactive layer.

**Settle (`lib/settle.ts`)** — greedy min-transfer; ignores unconfirmed AI-draft expenses; UPI deep links with graceful fallback when a member has no UPI ID.

**Offers (`lib/offers.ts`)** — context-triggered affiliate surfacing; attribution `subId = tripId.offerId.memberId`; clicks via `/api/offer/[id]/click`; conversions via signed `/api/partners/[partner]/postback`. **Honesty guardrail:** never recommend a sponsored option unless a genuine fit; always label "Booking option"/"Sponsored".

**Boost** — priority Vision OCR, itinerary connection flags, enriched suggestions, flight tracking, news monitoring. Gate server-side via `boost_status`.

---

## 6. Concierge — intents + proactive layer

**Reactive intents** (deterministic-first, LLM fallback, context-aware, never return silence):
`connectivity` (SIM/eSIM — domestic → existing SIM works; international → eSIM/Airalo), `power` (adapters — domestic → none needed; international → plug type/voltage), `itinerary_check` (run the checker on demand), `trip_qa` (general trip Q&A), `concierge_other` (transport/ATM/pharmacy via Places), plus the existing dining/sightseeing/weather. Compute a **domestic-vs-international** flag once (destination vs members' home country) and pass it in.

**Proactive layer (cron, NOT `/sync`):** every ~15 min select active/upcoming trips; **atomic per-trip claim** (`trips.last_concierge_run_at` / `concierge_cooldown_until`) so concurrent runs don't double-fire; change-gate the LLM audit via `last_audit_hash`; 429 → cooldown + backoff. Features: one **daily morning briefing** (weather + today + advisories + open flags, destination local time), **itinerary failure re-audit**, **flight tracking** [Boost], **disruption news** [Boost].

**Governing rules:** bundle routine info into the daily briefing; interrupt immediately only for material events (flight change, new failure, emergency); respect mute/quiet-hours/prefs; dedupe; stay under the **daily cost cap** (₹100 standard / ₹2000 Boost). Medical → nearby care + verified local emergency number, **never a diagnosis**.

---

## 7. Security model

Implemented: HMAC-signed session cookies (`httpOnly`,`secure`,`sameSite=lax`) backed by the revocable `user_sessions` table (validated each request, expirable); `authorizeTripAccess(tripId, {role?})` on **every** `/api/trip/[tripId]/*` route **and** server component (reads included); actor identity resolved from the session, request-body IDs (`paid_by`, `assigned_to`, `proposedBy`) ignored; dev backdoor gated to `NODE_ENV==='development'` returning a dummy account.

**Open security TODOs (treat as required before launch):**
- **Voucher storage URLs:** vault files hold PII — serve via signed/short-lived URLs or bucket RLS scoped to trip members, never public URLs.
- **Partner postback signatures:** verify a per-partner secret on `/api/partners/[partner]/postback` (prevent forged conversions).
- **Prompt-injection / output validation:** strictly schema-validate all LLM output; untrusted chat must not drive writes (esp. auto-populated checklist items).
- **Invite-token entropy/expiry:** ≥128-bit random `invite_token`; consider expiry/rotation.
- **Rate limiting:** per-user/IP on `/message`, `/sync`, and AI paths.

---

## 8. AI behavior rules (apply everywhere)

Human confirms anything consequential (decisions, expenses). Personal/medical handled sensitively — never broadcast a `personal` checklist item or a health detail to the group; reminders are 1:1. Bookable suggestions disclosed. The AI never rewrites or re-attributes a person's words.

---

## 9. Env (`.env.local`)

`DATABASE_URL`, `SESSION_SECRET`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_VISION_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PAYMENTS_WEBHOOK_SECRET`, partner keys (`BOOKING_AFFILIATE_ID`, `VIATOR_API_KEY`, `INSURANCE_PARTNER_KEY`, `ESIM_PARTNER_KEY`, `FOREX_PARTNER_KEY`, `TRANSPORT_AFFILIATE_ID`), `POSTHOG_KEY`. **No secret may carry a `NEXT_PUBLIC_` prefix.**

## 10. Commands

`npm run dev` (localhost:3000) · `npm run build` · `npx cap sync` · Android bundle via Gradle `bundleRelease`.

---

## 11. Current status & prioritized next tasks

The app is largely built (auth, orchestrator, money, vault, itinerary, checklist, admin, monetization scaffolding). Work in this order:

1. ~~**Concierge intents (reactive)**~~ ✅ Done — `connectivity`/`power`/`itinerary_check`/`trip_qa`/`concierge_other` added with domestic/international flag. `connectivity` and `power` are deterministic-first (no LLM cost). `itinerary_check` runs the checker inline.
2. ~~**Concierge proactive layer**~~ ✅ Done — `/api/cron/concierge` route with atomic per-trip claim, 15-min interval, 429 → 30-min cooldown, `last_audit_hash` change-gate on LLM itinerary audit. Schema migrations added. Secure with `CRON_SECRET` env.
3. ~~**Security TODOs**~~ ✅ Done — (a) voucher files now served via HMAC-signed 1h proxy URLs (no public `/uploads`); (b) per-partner postback secrets (`PARTNER_POSTBACK_SECRET_<PARTNER>`) with shared fallback; (c) LLM output sanitized (null bytes, HTML stripped, 4000-char cap) before DB write; (d) invite tokens upgraded to 256-bit with 30-day expiry enforced on join; (e) removed illegal `runProactiveConciergeChecks` call from `/sync`.
4. ~~**Itinerary time math**~~ ✅ Done — `starts_at`/`ends_at`/`tz` columns added to schema + `ItineraryItem` type. Checker rewritten: true interval-intersection overlaps, tz-aware blank-day detection via `Intl.DateTimeFormat`, gap = `end_a → start_b` (not start-to-start), 90-min threshold for connecting flights vs 30-min for other transitions. Legacy `date`/`time` fields kept as fallback.
5. ~~**Mobile architecture**~~ ✅ Done — WebView-loads-Vercel pattern confirmed; `capacitor.config.ts` consolidated with env-driven `CAPACITOR_SERVER_URL`, `cleartext` dev-only guard, `android:dev` / `android:prod` scripts added.

When you complete a task, update §11 and add a one-line note to a `CHANGELOG`.
