# JuntoFun — AI Concierge: Correction Brief

> **For the Antigravity agent:** This corrects defects found in the AI Concierge implementation. **P0 is the priority and must be done first** — the concierge currently pings Gemini on every poll, exhausts the daily quota (429 / `RESOURCE_EXHAUSTED`), and stops working. Fix the rate-limiting at the root, then work down.

---

## P0 — Stop the API from pinging itself to death

**Root cause:** the proactive concierge is invoked from `GET /api/trip/[tripId]/sync`, which every client hits every 3 seconds, and the only guard is an **in-memory `Map` (`lastChecked`)**. In serverless that Map is per-instance and lost on cold start, so it does **not** limit anything across instances — the LLM gets called far more than every 3 minutes, hits the rate limit, and the feature falls over. Fix with four layers (defense in depth):

### P0.1 — Take proactive work OFF the polling path
`/sync` must **return data only** — remove every LLM / concierge call from it. Run all proactive work (itinerary audit, morning briefing, flight check, disruption scan) from a **scheduled cron job** (Vercel Cron / scheduled function) that runs every ~15 min, queries trips that are upcoming/active, and processes them. Polling frequency must have **zero** effect on how often the LLM is called.

### P0.2 — Persistent, atomic cooldown (replaces the in-memory Map)
Store the last-run time in the **database**, and claim each run atomically so concurrent invocations can't double-fire:

```sql
ALTER TABLE trips
  ADD COLUMN last_concierge_run_at TIMESTAMPTZ,
  ADD COLUMN concierge_cooldown_until TIMESTAMPTZ,
  ADD COLUMN last_audit_hash TEXT;
```

```typescript
// Atomic claim — only ONE caller wins the window; the rest get no row and bail.
const claimed = await query(
  `UPDATE trips SET last_concierge_run_at = now()
   WHERE id = $1
     AND (last_concierge_run_at IS NULL OR last_concierge_run_at < now() - interval '15 minutes')
     AND (concierge_cooldown_until IS NULL OR concierge_cooldown_until < now())
   RETURNING id`, [tripId]
);
if (claimed.rowCount === 0) return; // someone else ran it, or we're in cooldown
```

### P0.3 — Only call the LLM when something changed
Compute a hash of the itinerary (ids + dates + times). If it equals `last_audit_hash`, **skip the LLM audit entirely** — there's nothing new to check. Update the hash after a successful audit. Deterministic checks may run, but the expensive LLM call is gated on change.

### P0.4 — Hard daily budget cap (covers reactive AND proactive)
Before **any** Gemini call, sum today's spend for the trip from `ai_metrics`; if it's at/over the cap, skip the LLM and use the deterministic fallback. Record **every** call — fix the schema so proactive calls are logged too:

```sql
ALTER TABLE ai_metrics ALTER COLUMN message_id DROP NOT NULL; -- proactive calls have no message
```

### P0.5 — Back off on 429, don't retry-loop
On `RESOURCE_EXHAUSTED` / 429, set `concierge_cooldown_until = now() + backoff` (exponential, e.g. 5 → 15 → 60 min) and short-circuit all LLM calls until it passes. Never retry in a tight loop. Keep the existing good behavior of **skipping the warning update on failure** (don't post partial/empty lists — that caused the oscillating cards).

**Net effect:** under any amount of client polling, the LLM is called at most once per 15-min window per trip, only when the itinerary changed, only under the daily budget, and never while in 429 cooldown.

---

## P1 — Safety & correctness

### P1.1 — Stop hardcoding medical/emergency contacts
`matchDeterministicMedicalRequest` ships fixed hospital numbers for 4 cities — these can be wrong/stale (a real harm in a medical moment) and don't scale. Replace with: a **live Google Places lookup** for nearby clinics/hospitals/pharmacies near the member, and **lead with the verified local emergency number** from Local Info (not a hospital switchboard). Keep the warm tone and "seek professional care" framing; never diagnose. For clearly urgent wording, surface emergency services first.

### P1.2 — Fix timezone-naive time handling (the checker's core math)
`itinerary_items.time VARCHAR(5)` has no timezone and no end/duration, so connection/overlap math is wrong across timezones (which flights always cross) and overlaps can't really be detected. Change to real instants + duration:

```sql
ALTER TABLE itinerary_items
  ADD COLUMN starts_at TIMESTAMPTZ,
  ADD COLUMN ends_at   TIMESTAMPTZ,
  ADD COLUMN tz        TEXT;          -- IANA zone, e.g. 'Asia/Kolkata'
```
Redo gap/overlap math on `starts_at`/`ends_at`. Make connection thresholds transition-aware (flight vs activity) instead of a flat 90 min, and detect flight overlap by interval intersection, not exact-start equality.

### P1.3 — Gate Capacitor dev config out of production builds
`server.url: 'http://192.168.1.17:3050'` + `cleartext: true` must **never** ship in a release build (it points the app at a dev machine over cleartext = broken app + MITM). Build the production config with no `server.url` and `cleartext: false`; gate on build env, don't rely on manual commenting.

---

## P2 — Hardening

- **Escape names before `RegExp`.** `new RegExp(\`\\b${nameLower}\\b\`)` breaks or ReDoSes on names with regex metacharacters. Escape the name first (or use plain word-boundary tokenization).
- **Prompt injection / output validation.** Validate every LLM response against a strict schema (zod) before it touches DB state; untrusted chat must not be able to drive state changes.
- **Authorization.** `POST /message` and `GET /sync` must both call `authorizeTripAccess`; the message author comes from the session, never the request body. The concierge must not be a path that bypasses this.
- **Blunt deterministic matchers.** Handle negation ("don't bring…" should not create an item; symptom-free "this is sick" slang should not trigger medical), and keep AI-added items clearly tagged (`source='ai_chat'`) and one-tap removable.

---

## Acceptance criteria

1. With multiple clients polling `/sync` continuously, Gemini is called **at most once per 15-min window per trip** — verified by `ai_metrics` rows, not by client count. `/sync` itself makes **no** LLM calls.
2. If the itinerary hasn't changed, **no** LLM audit runs (hash match).
3. When the daily budget is hit, the system serves deterministic fallbacks and makes **no** further LLM calls that day.
4. On a 429, the concierge enters cooldown and stops calling until it expires; warning cards do **not** oscillate.
5. Proactive (cron) features fire on schedule even when no client is polling.
6. Medical replies come from live Places + the verified emergency number; no hardcoded hospital numbers remain.
7. Itinerary time math is correct across timezones; overlaps and tight connections use real start/end instants.
8. Production mobile builds contain no dev `server.url` / `cleartext`.
