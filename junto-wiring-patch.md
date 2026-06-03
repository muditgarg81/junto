# Junto — Wiring Patch (home routing, avatar link, name dedup, onboarding)

> **For the Antigravity agent:** This is a small **wiring/integration patch**, not a rebuild. The profile screens already exist and work (`/profile` hub and `/profile/account` both render correctly) — **do not rebuild them.** The gap, confirmed by clicking through the running app, is that the home screen and data model were never connected to those screens. Fix the four items below only.

## Confirmed current state (from the running app)

- ✅ `/profile` and `/profile/account` exist and render.
- ❌ `/` always renders the logged-out **welcome**, even for a user with a profile.
- ❌ No trips-list route — `/trips` and `/your-trips` both **404**.
- ❌ The home avatar is **not a link** — `/profile` is unreachable from home.
- ❌ `/create-trip` **still has a "Your name" field** — the User/Member split was never applied, so the redundant name prompt persists.

## Task 1 — Build "Your Trips" home and route it at `/`

- Build the **Your Trips** screen: serif greeting "Hi, {firstName}", the user's avatar in the **top-right linked to `/profile`**, an "UPCOMING" section of trip cards (destination thumbnail, name, dates, member-avatar cluster, status pill) and a dimmed "PAST" section, plus secondary "Start a trip" and "Join with a link" buttons.
- **Routing at `/`:** if a user profile/session exists → render Your Trips; else → Welcome. (Currently `/` hardcodes Welcome.)
- Each trip card links to that trip (`/trip/[id]/plan`).

## Task 2 — Link the home avatar to the profile hub

- The avatar on both Welcome (the floating "N") and the Your-Trips header must link to **`/profile`** (which already exists). Right now it renders as a non-interactive element.

## Task 3 — Apply the User/Member split and remove the name field from create-trip

- **Data model:** introduce a persistent `User { id; name; avatar_url?; email; home_currency; payout_handle? }` created once; change `Member` to `{ id; trip_id; user_id; status; roles[] }` — **drop `Member.name`**; name/avatar derive from `User`.
- **`/create-trip`:** **remove the "Your name" field** (the "e.g. Mudit" input). The creator's name comes from their `User` profile.
- **Joining a trip:** creates a `Member` linking `user_id` ↔ `trip_id` with **no name prompt**.

## Task 4 — Add first-run onboarding

- A one-time **onboarding** screen that creates the `User` (name required; optional avatar, home currency, optional UPI ID), then routes to `/` (Your Trips).
- **First-run detection:** no local profile/session → Welcome → Onboarding → `/`. A returning user skips straight to Your Trips.

## Acceptance criteria (I will verify these in the running app)

1. `/` shows **Your Trips** for a user with a profile; Welcome appears only when logged out.
2. A trips-list view renders trip cards that open a trip (no more `/trips` 404).
3. The home/Your-Trips avatar **links to `/profile`**.
4. `/create-trip` has **no "Your name" field**.
5. Onboarding creates the profile once and lands on Your Trips; the name is not asked again when creating or joining a trip.
