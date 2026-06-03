# Junto — Affiliate Enrollment & Execution Plan (standalone workstream)

A self-contained plan for the affiliate workstream so it can run in its own chat.

## How to use this
1. Open a **new Claude chat** with the **Chrome extension connected**.
2. Paste the **Kickoff message** below as your first message. (Optionally also attach `junto-affiliate-partners.md` and `junto-admin-affiliates-build.md` for the full catalog and the in-app integration.)
3. Work through the programs in the order in Part D. Update the tracker in Part G as you go.

---

## Kickoff message (copy-paste into the new chat)

```
I'm building Junto, an AI-powered group-travel planning app (friends coordinate a trip,
split expenses, build a shared itinerary; we surface clearly-labeled booking options at
the moment of decision). I want to (1) enroll in travel affiliate programs and (2) wire
them into the app.

For enrollment, use the Chrome extension this way: open each program's signup page, read
the terms/commission/payout, and tell me field by field what to enter — but I do the
account creation, identity/PAN/GST, payout details, "Sign in with Google," CAPTCHAs, and
all form submits myself. Don't submit on my behalf or sign in as me.

Start with Travelpayouts, then Amazon Associates India, then GetYourGuide and Viator,
then Cuelinks. Reuse this description on every application:

"Junto is an AI-powered group-travel planning app. We help friend groups coordinate trips
end to end — agreeing dates and destinations, splitting expenses, and building a shared
itinerary. We surface relevant, clearly-labeled booking options (hotels, activities,
insurance, eSIM, transfers) at the moment users are actively deciding, inside their
planning flow — no spam, no incentivized clicks, fully disclosed. We expect strong
conversion because placements are contextual to a group's confirmed trip details."

After I'm approved in each, help me wire the affiliate links into the app (link templates
with my issued IDs, the partner config, and click+postback attribution).
```

---

## Part A — Context primer (what Junto is)
AI-powered group-travel app. Friends plan a trip together; the AI turns chat into a shared plan, splits expenses, and builds an itinerary. Monetization = clearly-labeled booking affiliate options surfaced at the decision moment, plus a paid "Boost" upgrade. India-first (UPI, INR).

## Part B — Have ready before you start
- Individual vs. business entity choice
- PAN (and GST if registered)
- Payout method: bank / PayPal / Wise
- **A public, reviewable URL for Junto** (deployed app or a landing page) — **this is the gating prerequisite**; `localhost` won't pass program review. If Junto isn't live, stand up a simple landing page first.
- A rough audience/traffic estimate

## Part C — Application blurb (reuse everywhere)
> Junto is an AI-powered group-travel planning app. We help friend groups coordinate trips end to end — agreeing dates and destinations, splitting expenses, and building a shared itinerary. We surface relevant, clearly-labeled booking options (hotels, activities, insurance, eSIM, transfers) at the moment users are actively deciding, inside their planning flow — no spam, no incentivized clicks, fully disclosed. We expect strong conversion because placements are contextual to a group's confirmed trip details.

## Part D — Enrollment order & programs

Start with the broadest, then add direct/high-margin programs.

1. **Travelpayouts** (travelpayouts.com) — one account covers hotels, flights, insurance, eSIM, transfers, car rental. Highest leverage; do first.
2. **Amazon Associates India** (affiliate-program.amazon.in) — packing/travel gear (~1–4%).
3. **GetYourGuide** — activities (~8%, Partnerize).
4. **Viator** (Tripadvisor) — activities (~8%, Impact).
5. **Cuelinks** (cuelinks.com) — India aggregator for MakeMyTrip/Goibibo and local merchants.
6. **Then, as you grow:** Airalo (eSIM, ~10%), an insurance partner (SafetyWing/World Nomads, ~10%+, **licensed-partner/compliance check** in India), Wise/Revolut (forex), a photo-book partner (Mixbook/Zoomin) for the post-trip yearbook.

(Full catalog, indicative rates, and link templates are in `junto-affiliate-partners.md`.)

## Part E — The walkthrough method (Claude + Chrome extension)
- **Claude does:** open each signup page, read the commission/payout/terms aloud, and tell you field by field what to enter.
- **You do:** create the account, enter identity (PAN/GST), payout details, "Sign in with Google," solve CAPTCHAs, accept terms, and click submit. Claude won't do these or authenticate as you.
- **Note:** when a signup moves to a new domain (e.g. `passport.travelpayouts.com`), the extension will ask you to approve that domain before Claude can read it — approve it, then continue.

## Part F — After approval: wire into the app
For each approved program:
1. Copy the **issued affiliate/publisher ID** (marker / AID / tag / partner_id).
2. Put it in the partner config — env var or, better, the DB-backed `Partner` table from `junto-admin-affiliates-build.md` so you can manage it live.
3. Build outbound links from the template with your ID and the attribution sub-id `tripId.offerId.memberId`.
4. Route clicks through `/api/offer/[id]/click` (records the click, redirects with the sub-id) and receive conversions on `/api/partners/[partner]/postback`.
- Detail: `junto-affiliate-partners.md` (templates + `partners.config.ts`) and the monetization brief (offers/attribution).

## Part G — Status tracker (maintain as you go)

| Program | Applied | Approved | ID obtained | Wired into app | Live |
|---|---|---|---|---|---|
| Travelpayouts | ☐ | ☐ | ☐ | ☐ | ☐ |
| Amazon Associates IN | ☐ | ☐ | ☐ | ☐ | ☐ |
| GetYourGuide | ☐ | ☐ | ☐ | ☐ | ☐ |
| Viator | ☐ | ☐ | ☐ | ☐ | ☐ |
| Cuelinks | ☐ | ☐ | ☐ | ☐ | ☐ |
| Airalo (eSIM) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Insurance partner | ☐ | ☐ | ☐ | ☐ | ☐ |
| Forex (Wise/Revolut) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Photo-book partner | ☐ | ☐ | ☐ | ☐ | ☐ |

> **First blocker to clear:** a public URL for Junto (Part B). Without it, applications stall at review. Everything else is ready to execute.
