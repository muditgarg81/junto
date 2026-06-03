# Junto — Boost Features Implementation (Build Brief)

> **For the Antigravity agent:** Deliver the four features the Boost page sells. Each must (a) actually work and (b) genuinely differ for a boosted trip. The entitlement gate (§1) is the prerequisite — build it first — and it **must be enforced server-side** (see the security remediation brief; never trust the client for entitlement). The three AI features include their verbatim prompts.

## The promise (from the Boost page)

| Feature | Promised to users |
|---|---|
| Priority Gemini Vision OCR | Fast parsing of hotel/flight receipts and vouchers |
| Itinerary Connection Flags | Auto-detect tight flights, overlays and booking conflicts |
| Enriched AI suggestions | Contextual activities matching group chats |
| Group-wide upgrade | Pay once, unlock premium for every roster member |

---

## 1. Foundation — entitlement & gating (delivers "Group-wide upgrade")

- Add `trips.boost_status VARCHAR DEFAULT 'none' CHECK (boost_status IN ('none','active'))` (or reuse the `TripUpgrade` table from the monetization brief).
- **Payment:** the page's "Payment Gateway" opens **Razorpay hosted checkout** (₹499). **No card data touches Junto.** On the provider's webhook success → set `boost_status = 'active'` for that trip.
- **Trip-level, not per-user:** any one member pays; the whole roster is upgraded.
- **Server-side gate:** `async function isBoosted(tripId): Promise<boolean>` reads `boost_status` from the DB. Every premium endpoint calls it (after `authorizeTripAccess`) and returns 403 if not boosted. **Never** gate on a client flag.

---

## 2. Priority Gemini Vision OCR (delivers "fast parsing")

Make the existing voucher-extraction pipeline genuinely faster/better for boosted trips:
- **Free trips:** standard async queue, base Flash vision, single pass.
- **Boosted trips:** a **priority lane** — process synchronously on upload (no batch wait), allow a higher-tier vision model, run a two-pass extract-then-verify for accuracy, parallelize multi-page docs, and retry on low confidence.
- Route by `isBoosted(tripId)` when enqueuing the extraction job.

**Extraction prompt (vision call):**
```
You are a travel-document extraction assistant. The attached image/PDF is a travel
booking (flight, hotel, activity, or transport voucher).

1. Identify docType: 'flight' | 'hotel' | 'activity' | 'transport'.
2. Extract the fields for that type:
   - flight:    airline, flightNo, departAirport, departTime, arriveAirport, arriveTime, pnr, passengers[]
   - hotel:     name, address, checkIn, checkOut, confirmationNo, guests
   - activity:  provider, title, date, time, location, voucherCode, contact
   - transport: company, driverName, phone, pickupTime, pickupPlace
3. For EVERY date, also return a confidence and a flag if the format is ambiguous
   (e.g. 05/06/2026 could be DD/MM or MM/DD). Never silently guess a date.
4. Do not invent fields that are not present; use null.

Return ONLY JSON: { "docType", "fields": {...}, "dateFlags": [{field, value, ambiguous, confidence}] }
```

---

## 3. Itinerary Connection Flags (delivers "auto-detect tight flights, overlays, conflicts")

A conflict engine that runs on boosted trips after any itinerary/booking change.

- **Deterministic pass (`lib/connectionFlags.ts`):** sort `itinerary_items` by datetime; for each consecutive pair compute the gap and flag:
  - **Tight connection** — gap below a transition threshold (e.g. flight→next ≥ landing+transfer buffer; →flight ≥ check-in buffer).
  - **Overlap** — two items whose time ranges intersect.
  - **Geographic impossibility** — different locations with a gap shorter than estimated travel time.
  - **Stay gaps** — checkout date earlier than the departing flight, or a night with no accommodation.
- **LLM pass (boosted only)** for fuzzy conflicts the math misses (venue closing hours, realistic transfer time, insufficient rest). 
- Surface flags on the itinerary as the terracotta markers already designed ("Tight connection — 40 min").

**Conflict-check prompt:**
```
You are reviewing a trip itinerary for scheduling risks. Here is the ordered list of
items (each with id, type, date, startTime, endTime, location) and the trip context.

Flag only REAL risks a traveler would care about: tight connections, overlapping
commitments, geographically impossible transitions in the available time, venue-hours
conflicts, or no rest after a long-haul/overnight leg. Be conservative — do not invent
problems. Do not flag normal, comfortable gaps.

Return ONLY JSON: { "flags": [{ "itemId", "severity": "info|warn|risk", "message" }] }
```

---

## 4. Enriched AI suggestions (delivers "contextual activities matching group chats")

On boosted trips, the AI proactively suggests activities grounded in the group's conversation and trip context, placed into itinerary gaps. Each suggestion can become a proposal or be added — and links to a bookable **activity affiliate offer** (so this feature also drives revenue).

- **Input:** recent chat (interests/vibe), destination, dates, budget band, who's going, and the current itinerary (to target gaps and avoid duplicates).
- **Output:** ranked suggestions, each citing the chat signal that motivated it.
- Gate behind `isBoosted`; surface as a "Suggested for you" strip in the itinerary gaps.

**Suggestion prompt:**
```
You suggest activities for a group's trip. Use ONLY what fits the group's stated
interests, budget, and who is going. Inputs: recent chat messages, destination, dates,
budget band, members, and the current itinerary (with gaps).

Rules:
- Match the group's expressed vibe and interests; cite the chat line that motivated each.
- Respect the budget band. Place each in a real itinerary gap; don't duplicate existing items.
- 3–6 suggestions, ranked by fit.

Return ONLY JSON: { "suggestions": [
  { "title", "whyItFits", "chatSignal", "suggestedDay", "estCostPerPerson", "category" }
]}
```

---

## 5. Economics note

These three are your **heaviest inference calls** (priority/multi-pass vision, the LLM conflict pass, suggestion generation). Gating them behind the ₹499 Boost is deliberate: the trips generating the most AI cost are the ones paying for it, which aligns COGS with revenue — exactly the ratio the unit-economics view should track.

## 6. Acceptance criteria

1. Paying the Boost sets `boost_status='active'` for the **whole trip**; all members see premium features. No card data touches Junto.
2. A **free** trip does **not** get priority OCR, connection flags, or enriched suggestions; a boosted trip does.
3. Vouchers on a boosted trip process in the **priority lane** (immediate, multi-pass) and return structured fields with date-ambiguity flags.
4. Connection flags appear on a boosted itinerary for a tight/overlapping/geographically-impossible sequence, and not for comfortable ones.
5. Enriched suggestions appear for a boosted trip, are grounded in the group's chat (each cites its signal), and land in itinerary gaps.
6. Every premium endpoint enforces `isBoosted` **server-side** after `authorizeTripAccess`; a free-trip client calling a premium endpoint gets 403.
