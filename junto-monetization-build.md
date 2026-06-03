# Junto — Monetization Build Brief (Revenue Model & Features)

> **For the Antigravity agent:** This brief **extends `junto-antigravity-build.md`**. Build the core app first (at minimum M0–M4: data model, decisions, expenses, vault). Then implement the milestones here (M6–M11). Keep this file at the repo root alongside `AGENTS.md`. Same stack, tokens, and guardrails as the core brief apply. Run + verify after each milestone (§13).

---

## 1. Strategy (read before building)

Junto's revenue does **not** come from charging for the planning tool — that would shrink the funnel that is the actual asset. The model is:

> **Keep all planning free → capture a whole group at peak travel-purchase intent → monetize the bookings and high-margin travel add-ons that planning leads to, plus a light group upgrade that covers AI cost.**

Three revenue layers, in priority order:
1. **Affiliate commission** on what the group is about to buy — hotels (~4–10%), activities (~8–20%), and especially **insurance / eSIM / forex** (often 20–40%, sold the moment dates and destination lock).
2. **"Boost this trip"** — a small per-trip group upgrade (not an individual subscription) that unlocks premium AI features and **covers per-trip LLM cost**.
3. **Transport** affiliate (rides, transfers) surfaced at expense moments.

Everything below builds the machinery to do this **without breaking trust** (§12).

## 2. What's missing today (gap analysis)

The core app has no way to earn. These pieces are absent and must be built:
- A **commerce/offers layer** — there's no concept of a bookable, monetizable option anywhere.
- A **partner integration layer** — no adapters for hotel/activity/insurance/eSIM/forex/transport inventory.
- **Attribution & conversion tracking** — no way to record a click or get paid for a booking (this is where value leaks).
- An **offer-surfacing engine** — logic that shows the right offer at the right moment.
- **Billing** — no way to charge for the trip upgrade.
- **Unit-economics instrumentation** — no measurement of revenue-per-trip vs AI-cost-per-trip.
- **Transparency UI + AI honesty guardrail** — no sponsored labeling or conflict-of-interest protection.

## 3. New data model

```typescript
Offer        { id; trip_id; category:'hotel'|'activity'|'insurance'|'esim'|'forex'|'transport';
               partner; title; price; currency; deep_link;          // deep_link carries the sub-id
               commission_estimate; surfaced_by;                     // e.g. 'dates_locked','flight_ingested'
               status:'shown'|'clicked'|'converted'|'dismissed'; created_at; }
OfferClick   { id; offer_id; member_id; sub_id; clicked_at; }        // sub_id = tripId.offerId.memberId
Conversion   { id; offer_id; sub_id; gross_amount; commission; confirmed_at; }  // from partner postback
TripUpgrade  { id; trip_id; tier:'boost'; paid_by; provider:'razorpay'|'stripe';
               provider_ref; amount; status:'pending'|'active'|'failed'; }
```

`PartnerAdapter` is a **code interface**, not a table:

```typescript
interface PartnerAdapter {
  category: OfferCategory;
  search(criteria): Promise<PartnerResult[]>;          // criteria = destination, dates, pax, budget
  buildDeepLink(result, subId: string): string;        // affiliate URL with tracking sub-id
}
// Implement one adapter per partner; register them in a registry keyed by category.
```

## 4. Offer-surfacing engine (the heart) — `lib/offers.ts`

Offers are created by **triggers tied to events the core app already emits**. Show the right thing at the right moment; never spam.

| Trigger (event) | Surface | Why it converts |
|---|---|---|
| `dates` + `destination` both locked | **Travel insurance** offer | Highest-margin; intent is certain |
| `hotel` Decision opened (type='hotel') | Real **bookable hotel options** as Decision `Option`s, beside any manual ones | Lives exactly where they're choosing |
| Flight `VaultItem` ingested | **eSIM** offer; **forex/travel-card** if international | You now know they're flying |
| Itinerary gap / activity interest detected in chat | **Activity** offers (e.g. scuba) | High margin, fills real gaps |
| Transport expense or "need a cab" in chat | **Ride / transfer** affiliate | In-trip, immediate need |

The AI orchestrator (core §8) may also flag intent ("anyone know a good hotel?") and *ask* before surfacing — but offers are always **additive options**, never the AI overriding the group's own choices (§12).

## 5. Partner integration layer — `lib/partners/`

One adapter file per partner implementing `PartnerAdapter`. Start with one partner per category, stub the rest:
- **Hotels:** Booking.com / Agoda affiliate or an aggregator API.
- **Activities:** Viator / GetYourGuide.
- **Insurance / eSIM / forex:** licensed distribution partners (see compliance, §14).
- **Transport:** Uber/Ola affiliate, airport-transfer partner.

Every outbound link is built via `buildDeepLink(result, subId)` where `subId = ${tripId}.${offerId}.${memberId}`. Never put personal data in the URL — only the opaque sub-id.

## 6. Attribution & conversion tracking

This is where money is won or lost — build it carefully.
- **Click tracking:** all offer links route through `/api/offer/:id/click`, which records an `OfferClick`, sets `Offer.status='clicked'`, then 302-redirects to the partner deep link with the sub-id. Click = leading indicator.
- **Conversion postback:** partners call `/api/partners/:partner/postback` (server-to-server) with the sub-id and amount; record a `Conversion`, set `Offer.status='converted'`. Confirmed revenue.
- **Reality check to design around:** conversions are **delayed and leaky** (people price-check elsewhere, postbacks lag days). Treat clicks as the funnel metric and conversions as the revenue metric; never assume a click is a sale.

## 7. Revenue surfaces (where they appear in existing screens)

- **Plan / hotel proposal** → bookable options inline in the Decision card, each with a "Booking option" tag.
- **Itinerary** → activity offers in gaps; "Add to plan" books via affiliate.
- **Vault** (after flight ingest) → an eSIM/forex banner card.
- **Money** → ride affiliate next to transport expenses.
- **Post-dates-lock moment in chat** → a single, dismissible insurance offer card from the AI.

New components: `OfferCard`, `SponsoredTag`, `BoostTripModal`, `InsurancePromptCard`.

## 8. "Boost this trip" upgrade + billing

- `POST /api/trip/:id/upgrade` → create a `TripUpgrade`, open the **payment provider's hosted checkout** (Razorpay for India, Stripe otherwise). **No card data ever touches Junto** — only a provider redirect/webhook.
- On provider webhook success → set `TripUpgrade.status='active'`, unlock premium AI features for the whole trip (richer itinerary suggestions, larger vault, priority extraction).
- Price low; frame as group value ("₹X unlocks this for everyone"). This layer's job is to cover per-trip LLM cost, not to be the business.

## 9. Unit-economics instrumentation — `lib/metrics.ts`

Wire an analytics provider (PostHog/Mixpanel) and emit events: `trip_created`, `decision_locked`, `offer_shown`, `offer_clicked`, `offer_converted`, `trip_upgraded`, and `ai_call` (with token count + cost). Build an internal metrics view computing, per trip and in aggregate:
- **Revenue per trip** = Σ confirmed commissions + upgrade fees.
- **AI cost per trip** = Σ token cost across all calls.
- **Funnel:** offers shown → clicked → converted.

The product is only viable when **revenue per converting group > AI cost per active group**. Surface this ratio from day one.

## 10. New API routes

```
/api/offer/[id]/click/route.ts          → record click, redirect to partner with sub-id
/api/partners/[partner]/postback/route.ts → S2S conversion webhook
/api/trip/[id]/offers/route.ts          → list offers surfaced for a trip
/api/trip/[id]/upgrade/route.ts         → start boost checkout (hosted)
/api/billing/webhook/route.ts           → provider success/failure
```

## 11. AI honesty addendum (append to the core system prompt §8.3)

```
You may surface partner "booking options" when the offer engine provides them, but:
- Commission NEVER influences your recommendations. Rank options only by genuine fit
  for the group (price, location, reviews, the group's stated budget and preferences).
- Always keep sponsored/booking options clearly distinct from your own neutral suggestions,
  and never imply a paid option is your recommendation unless it is genuinely the best fit.
- If asked, disclose plainly that booking options may earn Junto a commission.
```

## 12. Milestones (continue numbering from the core brief)

- **M6 — Offers foundation.** `Offer`/`OfferClick`/`Conversion` model, `PartnerAdapter` interface + registry, click-tracking route + postback webhook, `SponsoredTag`/`OfferCard`, and the honesty addendum. Stub one partner to test end-to-end.
- **M7 — Core funnel.** Hotel adapter wired into the hotel Decision; activity adapter wired into the itinerary. The booking moment, monetized.
- **M8 — High-margin offers.** Insurance on dates+destination lock; eSIM + forex on flight ingest (with international detection).
- **M9 — Transport.** Ride/transfer affiliate at expense + chat-intent moments.
- **M10 — Boost upgrade + billing.** Hosted checkout (Razorpay/Stripe), webhook, premium-feature unlock per trip.
- **M11 — Instrumentation.** Analytics events + the revenue-per-trip vs AI-cost-per-trip metrics view + the offer funnel.

## 13. Acceptance criteria

- Locking dates + destination surfaces a clearly-labeled insurance offer with a working **tracked** deep link.
- The hotel Decision shows real bookable options beside manual ones; each is tagged and carries a `subId`; clicking records an `OfferClick` and redirects correctly.
- A simulated partner postback records a `Conversion` and updates the metrics view.
- The boost flow upgrades a trip via hosted checkout with **no card data touching Junto**.
- The metrics view reports revenue-per-trip, AI-cost-per-trip, and the offers funnel.
- **Core planning remains 100% usable with zero purchases** — offers are additive only.
- The AI never presents a paid option as its recommendation unless it's the genuine best fit.

## 14. Guardrails & compliance

1. **Trust is existential.** Commission must never bias recommendations; sponsored content is always labeled. Breaking this breaks the product.
2. **Never gate the core.** Planning, chat, proposals, and settle-up stay free forever; monetization is additive.
3. **Track money, never hold it.** Affiliate partners handle their own checkout; the boost uses a provider's hosted flow.
4. **No selling user data.** Offers are generated from a trip's own data, used only to serve that trip.
5. **Don't monetize before adoption.** Ship offers only once the group-adoption flywheel works; premature paywalls/ads kill consumer social apps.
6. **Regulatory check (flag, not legal advice).** Distributing **insurance** and **forex** typically requires being or partnering with a licensed entity (e.g. IRDAI-regulated insurance distribution in India); becoming a merchant-of-record or touching payment flows triggers further compliance. Use licensed partners and confirm requirements per market before launch — Junto is not a licensed advisor or distributor by default.

## 15. Environment variables (add to core §14)

```
BOOKING_AFFILIATE_ID=
VIATOR_API_KEY=
INSURANCE_PARTNER_KEY=
ESIM_PARTNER_KEY=
FOREX_PARTNER_KEY=
TRANSPORT_AFFILIATE_ID=
RAZORPAY_KEY_ID=            # or STRIPE_SECRET_KEY
RAZORPAY_KEY_SECRET=
PAYMENTS_WEBHOOK_SECRET=
POSTHOG_KEY=               # analytics / unit economics
```
