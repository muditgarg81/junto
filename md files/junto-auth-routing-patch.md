# Junto — Auth & Logout Routing Patch

> **For the Antigravity agent:** Fixes the bug where **logout lands on `/onboarding`** instead of a sign-in screen. Root cause: there is no real authentication layer — onboarding (Create Profile) is doubling as the entry point, and the account screen falsely claims "Google Auth" while the profile is stored locally. This patch adds real auth and correct routing. Chosen approach: **real authentication** (not local-only).

## 1. The model

Three distinct states, currently collapsed into one:
- **Sign in / sign up** — logged-out entry; user authenticates here.
- **Onboarding (Create Profile)** — one-time, **only** for an authenticated user who has no profile yet.
- **Home / Your Trips** — authenticated user with a profile.

## 2. Auth layer

- Use **Supabase Auth** (matches the core stack): **Google OAuth** + **email magic-link**.
- On successful auth, look up the `User` profile by `auth_id`:
  - no profile → route to `/onboarding`
  - profile exists → route to `/` (Your Trips)
- The `User` profile persists **server-side, keyed to `auth_id`** — remove the "local traveler profile storage" model. (This also makes the account screen's "Google Auth" label true.)

## 3. Screens

- **`/signin`** — the logged-out entry (build it; see prompt below). Logged-out users land here.
- **`/onboarding`** — unchanged form, but now gated: only for authenticated users without a profile. Prefill name/email from the Google identity where available. On "Complete setup," create the `User` row, then go to `/`.
- **`/`** — routing hub (rules below).

### Stitch prompt — sign-in / sign-up
> Using the established design system, design a **sign-in / sign-up** screen (the logged-out entry). Warm paper background with a soft gradient wash. The serif "Junto." wordmark with a terracotta dot and the tagline "One living plan for the whole group." A primary pine "Continue with Google" button with the Google glyph; below it, an email field with a ghost "Email me a sign-in link" button. A small muted line: "Joining a trip? Just open your invite link." Footer: "We'll set up your traveler profile right after you sign in." Calm and single — no "Start a trip" here (that lives after sign-in).

## 4. Routing rules (middleware)

- **Any route, not authenticated** → redirect to `/signin`.
- **Authenticated, no profile** → redirect to `/onboarding`.
- **Authenticated, has profile** → `/` renders Your Trips.
- **`/onboarding` when a profile already exists** → redirect to `/` (so it can't be wandered into).
- **Logout action** → `supabase.auth.signOut()` → clear session → redirect to **`/signin`** (never `/onboarding`).
- **Invite link `/join/[token]`** → if not authenticated, send to `/signin` (preserving the invite), then after auth + onboarding, drop the user straight into that trip.

## 5. Remove / correct

- Remove local-only profile storage; profile lives in the DB tied to `auth_id`.
- Delete any logout handler that points to `/onboarding`.

## 6. Acceptance criteria (I will verify in the browser)

1. A logged-out visitor to `/`, `/onboarding`, or any trip route is redirected to **`/signin`**.
2. Signing in with **no** profile lands on `/onboarding`; signing in **with** a profile lands on Your Trips.
3. **Logout returns to `/signin`**, not `/onboarding`.
4. `/onboarding` redirects to Your Trips if a profile already exists.
5. The account screen's "Google Auth" reflects the real sign-in method.
