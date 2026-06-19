# Junto — Affiliate placement & integration plan

How affiliate booking options surface inside the app: **non-interfering, fully disclosed, but placed where confirmed intent + commission are both high enough to actually earn.** This is the product/UX layer that sits on top of the affiliate plumbing (Partner / Offer / Click / Conversion + click & postback endpoints).

---

## 1. The one rule

> An offer appears **only** at a moment of *confirmed trip intent*, framed as the group's **next step**, labeled as a booking option, and always dismissible. Never speculative, never in the chat feed.

Everything below is an application of that rule. The vehicles are the two surfaces that already exist and are *pull*, not *push*: the **pre-departure checklist** and the **AI concierge**. Offers live as checklist items and as things the concierge can surface when asked — not as banners injected into planning.

## 2. Interference guardrails (the "doesn't annoy" half)

- **Never** inject offers into the group chat feed, expense-splitting screens, or trip onboarding. Those are utility/early-intent moments — ads there read as spam and depress trust.
- **One** offer per decision point. No stacked carousels of partners.
- Every offer is **dismissible** with an "already booked / not needed" state, and a dismissed offer is **not re-shown** for that trip (frequency cap = 1, persisted per `tripId` + `offerId`).
- Show an offer only when it's **relevant to confirmed trip facts** — no eSIM/insurance/forex prompts on a domestic trip; no "Stays" offer if accommodation is already marked booked.
- **Disclosure** on every card: a quiet "Junto may earn a commission — price is the same for you." This is your positioning ("clearly-labeled, fully disclosed"), and it's required by Amazon/most networks anyway.
- The core loop (plan → split → itinerary) must work **100% with every offer dismissed**. Monetization is additive, never gating.

## 3. Placement map (trip lifecycle × partner × intent)

Priority is **intent × commission**, not coverage. Lead with the top three rows; everything below is fill-in.

| Trigger (confirmed fact) | Surface | Partner(s) | Comm. | Priority | Why it doesn't interfere |
|---|---|---|---|---|---|
| Activity/POI added to itinerary | Inline "book tickets" on that itinerary item | GetYourGuide, Viator | ~8% | **P0** | They just chose to do this — booking is the obvious next step |
| Dates + destination locked | Checklist item: "Travel insurance for the group" | SafetyWing / World Nomads *(IN compliance check)* | ~10%+ | **P0** | Genuinely needed; lives as a to-do, not a popup |
| International trip, pre-departure | Checklist item: "Get an eSIM" | Airalo | ~10% | **P0** | Naturally part of "ready to fly" |
| Trip ended | Post-trip "Make a trip yearbook" card | Mixbook / Zoomin (via Cuelinks if needed) | varies | **P1** | Delightful, zero overlap with active planning |
| Destination locked, no stay marked | "Stays" section of itinerary/logistics | Travelpayouts (hotels) | varies | **P1** | Appears where they'd already look for lodging |
| India domestic stay/flight need | Same Stays/Transport section | Cuelinks → MakeMyTrip/Goibibo | varies | **P1** | Local OTAs they'd use anyway |
| Arrival logistics in itinerary | "Airport transfer / car" prompt | Travelpayouts | varies | **P2** | Tied to a real arrival entry |
| Packing-list checklist generated | Optional gear links in packing items | Amazon Associates IN | ~1–4% | **P2** | Low margin — only if it adds genuine utility |
| International trip, pre-departure | Concierge answer when forex comes up | Wise / Revolut | varies | **P2** | Pull-only: surfaced when *they* ask |

**The money is in P0.** Activities (8%, perfectly contextual) + insurance/eSIM (10%+, genuinely needed) are where revenue concentrates. Resist the urge to wire everything at once — Amazon gear at 1–4% earns little and adds clutter.

## 4. The offer card (one reusable component)

Build a single `OfferCard` and reuse it everywhere; do not design per-partner UI.

- **Anatomy:** context line ("For your Goa trip, 12–15 Mar") → offer ("Travel insurance for 4 travellers from ₹X") → CTA ("View options") → disclosure line → dismiss ("Already sorted").
- **CTA** routes through `/api/offer/[id]/click` (records the Click, redirects with the `tripId.offerId.memberId` sub-id). Never link out raw.
- **States:** default → dismissed (collapsed, "Already sorted ✓", restorable) → booked (if a postback confirms, optionally show "Booked via Junto").
- **Group-aware copy:** it's a group app — say "for your group" / "4 travellers," not "you." Reinforces relevance, lifts conversion.

## 5. Trigger logic

- Triggers fire off **confirmed trip state**, not on render. Centralize as a small resolver: `offersForTrip(trip) → Offer[]`, given locked dates, destination, international-vs-domestic, itinerary items, checklist state, and dismiss history.
- Respect dismiss + frequency caps server-side so it's consistent across group members and devices.
- Derive `memberId`/`tripId` from session + trip membership (matches the click endpoint's anti-spoofing requirement) — don't trust client params.

## 6. Concierge integration (lowest-interference, high-intent)

When a member asks the AI concierge something bookable ("where should we stay in Goa?", "do we need insurance?"), the concierge answers genuinely **and** may append one relevant labeled offer. This is the least intrusive channel because it's entirely pull, and it converts well because intent is explicit. Rule: the helpful answer comes first and stands on its own; the offer is an addendum, never the whole reply, and the same disclosure applies.

## 7. Measurement (know it earns, know it doesn't annoy)

Track the minimum that answers both questions:

- **Earns:** clicks, click→book conversion, and **revenue per active trip**, sliced by surface. Kill any surface that doesn't convert after enough trips.
- **Annoys:** **dismiss rate** per surface (your annoyance proxy) and any rise in offer-related opt-outs. A high dismiss rate on a P0 surface = wrong moment or wrong offer, not "add more offers."
- Single north-star: **revenue per trip with dismiss rate held flat.** If revenue rises while dismiss rate stays low, the placement is working.

## 8. Phasing

- **Phase 1 (ship first):** OfferCard + the three P0 surfaces (itinerary-activity → GetYourGuide/Viator; checklist insurance; checklist eSIM). Concierge addendum for bookable questions. This is most of the revenue with the least surface area — and it only needs Travelpayouts + the two activity networks approved.
- **Phase 2:** Stays (Travelpayouts/Cuelinks) and the post-trip yearbook.
- **Phase 3:** Transfers, packing-list gear (Amazon), forex — only if Phase 1–2 metrics justify the added surface.

## 9. Open dependencies

- Affiliate plumbing from the build prompt (Partner/Offer/Click/Conversion, click + postback endpoints).
- Program approvals — Phase 1 only needs Travelpayouts + GetYourGuide + Viator + an insurance partner + Airalo.
- **Insurance in India:** carry forward your own flag — confirm the partner can legally be promoted to Indian users before wiring that P0 surface.
