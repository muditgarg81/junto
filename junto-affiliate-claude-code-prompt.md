# Claude Code prompt — Junto affiliate wiring

> Paste everything below the line into Claude Code, run from the root of the Junto repo.
> For exact link templates and per-partner specifics, also attach `junto-affiliate-partners.md`
> and `junto-admin-affiliates-build.md` if you have them — this prompt is written to work with or without them.

---

You are working in the **Junto** codebase — an AI-powered group-travel planning app (India-first; friends coordinate a trip, split expenses, build a shared itinerary). Monetization is clearly-labeled booking affiliate options surfaced at the decision moment, plus a paid "Boost" upgrade.

I need you to build the **affiliate plumbing** so that as I get approved into programs (Travelpayouts, Amazon Associates India, GetYourGuide, Viator, Cuelinks, and later Airalo / insurance / forex / photo-book), I can drop in each issued ID and start earning attributed commissions. No program is approved yet, so this is the foundation — it must work end-to-end with placeholder IDs and be ready to receive real ones.

## Step 0 — Ground yourself before changing anything

Do NOT start writing features blind. First:

1. Read the repo and confirm the actual stack, framework version, and conventions. I believe it's **Next.js (App Router) + TypeScript + Prisma + Postgres (Neon)**, but verify against the real code and follow whatever is actually there.
2. Search for anything affiliate/offer/partner-related that already exists: a `Partner` model, an `Offer` model, `partners.config.ts`, any `/api/offer/*` or `/api/partners/*` routes, existing link-building helpers.
3. Report back a short plan: what already exists, what you'll add, what you'll change, and any conflicts with my assumptions below. **Wait for my go-ahead before large or destructive changes** (migrations, deleting code). Small additive scaffolding is fine to proceed with.

## Step 1 — Data model (Prisma)

Add or reconcile these models. If equivalents already exist, extend rather than duplicate.

- **Partner** — DB-backed config (so I can manage it live without redeploys):
  - `slug` (e.g. `travelpayouts`, `amazon_in`, `getyourguide`, `viator`, `cuelinks`), display name, status (`active`/`pending`/`disabled`)
  - `affiliateId` / marker / tag (the issued ID), plus a free-form `credentials` JSON for partners that need more than one value
  - `linkTemplate` (URL template with placeholders) and `subIdParam` (the query param the partner uses for the sub-id, e.g. `marker`, `subId`, `tag`)
  - `commissionRate` (indicative, for display/estimates), `network` (e.g. Partnerize/Impact/direct), `allowedDomains` (array — used for redirect validation, see Step 3)
- **Offer** — a placeable booking option (hotel/activity/insurance/eSIM/transfer). Link to Partner. If an Offer model already exists, just ensure it can resolve to a Partner.
- **Click** — `id`, `offerId`, `partnerSlug`, `tripId`, `memberId`, `subId` (the composed `tripId.offerId.memberId`), `createdAt`, `userAgent`/`ip` hash (not raw PII), `redirectedTo`.
- **Conversion** — `id`, `partnerSlug`, `subId` (raw, as returned by partner), parsed `tripId`/`offerId`/`memberId`, `amount`, `currency`, `commission`, `status` (`pending`/`approved`/`rejected`), `rawPayload` JSON, `createdAt`, with a **unique constraint** for idempotency (e.g. partner + their conversion/transaction id).

Provide the migration but do not run it without telling me.

## Step 2 — Link building utility

A pure, well-tested function, e.g. `buildAffiliateUrl({ partner, offer, tripId, offerId, memberId })`:

- Composes the sub-id as **`tripId.offerId.memberId`** and injects it into the partner's `subIdParam`.
- Fills the partner's `linkTemplate` (deep link target + affiliate ID + sub-id).
- Falls back gracefully if the partner is `pending`/`disabled` (return the plain destination URL with no affiliate params, or null — your call, but make it explicit and safe).
- Read affiliate IDs from the **DB Partner row first**, with an **env-var fallback** (`TRAVELPAYOUTS_MARKER`, etc.) so local/dev works before the DB is seeded.

If `junto-affiliate-partners.md` is attached, use its exact templates and param names. If not, scaffold sensible per-partner templates and clearly mark them `// TODO: confirm against partner docs`.

## Step 3 — Click endpoint: `GET /api/offer/[id]/click`

- Resolves the Offer → Partner, builds the affiliate URL, records a **Click** row (with the composed sub-id), then **302-redirects** to the partner URL.
- **Security (this matters — Junto just went through a security audit):**
  - The redirect target must be validated against the partner's `allowedDomains` allowlist. **No open redirects** — never redirect to a host that isn't an approved partner domain.
  - `tripId`/`memberId` must be derived from the authenticated session / trip membership where possible, not blindly trusted from query params, to prevent attribution spoofing.
  - Hash or drop IP/UA; don't store raw PII.
- Fail safe: if anything errors, redirect to the plain destination rather than 500-ing the user out of their booking flow.

## Step 4 — Postback endpoint: `POST /api/partners/[partner]/postback`

- Receives conversion pings from each network (they differ in shape — handle per-partner parsing, keyed on the `[partner]` slug).
- **Verify authenticity**: signature/secret/IP allowlist per partner where the network supports it. Reject unverified posts.
- Parse the returned sub-id back into `tripId.offerId.memberId`, create/Upsert a **Conversion** row.
- **Idempotent**: duplicate postbacks (networks retry) must not double-count — rely on the unique constraint from Step 1.
- Always return the acknowledgement shape the specific network expects (some want `200 OK`, some want a specific body).

## Step 5 — Admin / config surface

- If `junto-admin-affiliates-build.md` describes an admin UI, follow it. Otherwise, at minimum provide a seed script + a documented way to set each Partner's `affiliateId` and flip `status` to `active` (DB-backed, no redeploy).
- Document the env-var fallbacks in `.env.example`.

## Out of scope (do not build now)

- The actual placement UI / where offers render in the planning flow.
- Real partner credentials (I'll add issued IDs as approvals land).
- Payout reconciliation dashboards.

## Acceptance criteria

1. With a seeded `active` Travelpayouts Partner + placeholder marker, hitting `/api/offer/[id]/click` records a Click and redirects to a correctly-composed, sub-id-tagged Travelpayouts URL.
2. Posting a sample Travelpayouts-shaped conversion to the postback endpoint creates exactly one Conversion, and a duplicate post creates none.
3. A redirect to a non-allowlisted domain is rejected.
4. Adding a second partner requires only a config/DB change, no new endpoint code.
5. Tests cover `buildAffiliateUrl`, the redirect allowlist, and postback idempotency.

Start with Step 0 and report your plan.
