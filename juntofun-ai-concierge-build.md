# JuntoFun — AI Concierge (Build Brief)

> **For the Antigravity agent:** Extend the chat orchestrator into a proactive concierge: itinerary failure detection, contextual suggestions from chat, flight tracking, a daily weather briefing, and emergency/disruption news. Several features need **external APIs**. Obey the anti-spam, privacy, and wellbeing rules in §0 — they're what keep this helpful instead of muted. LLM prompts are embedded per feature.

## 0. Governing principles (read first)

- **Proactive ≠ chatty.** Bundle routine info into ONE daily morning briefing (§4). Interrupt immediately only for **material** events: a newly detected itinerary failure, a flight change, or an emergency that affects this trip. Everything else waits for the briefing or a chat cue.
- **No repeats.** Never re-post the same alert; track what's been surfaced. Respect each member's mute / notification prefs and quiet hours.
- **Wellbeing (medical).** The AI is not a doctor. On a health cue it offers nearby care and, if it reads as urgent, the local emergency number (from Local Info) — never a diagnosis or treatment advice. Be calm and caring, not alarmist, and tactful about health in a group setting.
- **Disclosure.** Bookable suggestions (restaurants, etc.) are clearly labeled; affiliate links follow the honesty rules.
- **Cost/tiering.** Flight tracking (§3) and news monitoring (§5) are recurring paid-API calls per trip — gate them to **Boost** trips. Weather and Places are cheap and can be core.

## 1. Itinerary failure detection (expands Boost "Connection Flags")

Runs on every itinerary change **and** a daily re-check. Posts one concise chat alert per problem with a suggested fix.

**Deterministic + LLM check for these failure modes (at minimum):**
- An item scheduled **before arrival** or **after the return flight**, or outside the trip date range
- A **blank day** within the trip (no plan)
- **Overlapping** activities; **double-booked / overlapping flights**
- **Tight connecting-flight layovers** below safe minimums (longer for international↔domestic, terminal/airport changes, immigration)
- **Insufficient transfer time** between airport ↔ hotel ↔ activity
- A **night with no accommodation**, or **checkout before the departure flight**
- **Venue likely closed** (day-of-week / public holiday)
- **Geographically impossible** transitions in the time available
- **Outdoor activity on a severe-weather day** (cross-reference §4 forecast)
- **No rest buffer** after a red-eye / long-haul
- **Over-stuffed day** (too many items to be feasible)

**Prompt:**
```
You are auditing a group trip itinerary for ways it could fail. Inputs: ordered items
(id, type, date, start/end, location), outbound + return flight times, trip date range,
hotel check-in/out, and if available the weather forecast and any travel advisories.

Flag the failure modes listed in the brief. Be specific and conservative — only real
risks, not comfortable gaps. Give a helpful one-line fix for each.

Return JSON: { "flags": [{ "itemId": "<id|null>", "severity": "info|warn|risk",
"issue": "...", "suggestion": "..." }] }
```

## 2. Contextual concierge suggestions (reactive, from chat)

The orchestrator detects a current need in chat and **offers** help (never pushes). Examples the user asked for: dinner/food and medical.

**Detection prompt (add to orchestrator output):**
```
Detect a current, actionable need in the latest message(s):
- dining/food ("where should we eat", "dinner?") → intent='food'
- unwell/injury/medical ("not feeling well", "sprained ankle") → intent='medical' + urgency 'routine'|'urgent'
- other ("need an ATM/pharmacy/cab/things to do") → intent='other' with a label
Fire only on a clear, current need. For medical, never diagnose — only classify urgency.
Add to JSON: "concierge": { "intent": "none|food|medical|other", "query": "...", "urgency": "..." } | null
```

**Backend response by intent (uses Google Places + the trip location):**
- **food** → search nearby eateries / popular restaurants; post a short, labeled suggestion (bookable where possible).
- **medical** → search nearby clinics / hospitals / pharmacies near the member; post a brief, caring note with options. If `urgency='urgent'` or emergency wording → surface the **local emergency number** (Local Info) prominently and suggest emergency services first.
- **other** → relevant Places results for the labeled need.

## 3. Flight tracking (Boost)

- For each flight in the vault/itinerary, poll a **flight-status API** (e.g. AviationStack / FlightAware AeroAPI / Cirium — configurable).
- On a real change — delay, time change, gate change, cancellation — post an **immediate** alert to the affected members with the new details and a nudge: *"Your KL876 now departs 14:20 (was 12:10) — want me to re-check the rest of the day?"*
- Re-run §1 against the updated times automatically.

## 4. Daily morning briefing (weather + today)

- Each morning in the **destination's local time**, post ONE briefing combining: today's **weather** (weather API — OpenWeather / Open-Meteo / WeatherAPI), today's itinerary at a glance, any **weather-vs-activity clash** flagged, and any new **advisory** (§5) — all in a single warm message to minimize noise.

**Prompt:**
```
Compose a short, friendly "good morning" briefing for the group for {date} at {destination}.
Include today's weather (from the data provided), today's itinerary at a glance, and flag if
weather clashes with a planned activity. If a material advisory for today is provided, include
it calmly. Brief and warm. Use only the data given — do not invent forecasts or events.
```

## 5. Emergency / disruption news (Boost)

- **Pre-trip:** before departure, scan for events affecting the destination over the trip dates — strikes, natural disasters, major transit disruption, unrest, official travel advisories (news API + government advisory feeds). Surface a calm heads-up.
- **During-trip:** monitor and alert only if something **materially** affects the itinerary.
- **High relevance threshold** — this is not a news feed. Use the LLM to judge whether an item actually affects *this* trip before surfacing.

**Relevance/summarize prompt:**
```
Given these news/advisory items and the trip (destination, dates, itinerary), decide which —
if any — could materially disrupt the trip (safety, transport, closures, entry rules). Ignore
everything else. For each relevant item, write one calm, factual sentence and a suggested
action. Return JSON: { "alerts": [{ "summary": "...", "action": "..." }] }. Empty if none.
```

## 6. Delivery & cadence summary

| Feature | Trigger | Channel | Data source | Tier |
|---|---|---|---|---|
| Itinerary failures | on change + daily | group chat | internal + weather/advisory | core |
| Food/medical/other | clear chat cue | group chat (medical: caring/private-leaning) | Google Places | core |
| Flight changes | status change | affected members | flight API | Boost |
| Morning briefing | daily, local AM | group chat | weather API | core |
| Emergency news | pre-trip + during | group chat | news/advisory API | Boost |

## 7. Acceptance criteria

1. The itinerary checker detects each failure mode in §1, posts one clear alert + fix, and never repeats it.
2. A food cue yields nearby eatery suggestions; a medical cue yields nearby care handled per the wellbeing rule (no diagnosis; emergency number surfaced if urgent).
3. A real flight schedule change triggers an immediate alert to the affected members and re-runs the itinerary check.
4. Exactly one morning briefing posts per trip day in destination local time, flagging weather-activity clashes.
5. Pre-trip and during-trip, only trip-affecting disruptions are surfaced — calmly, with a suggested action.
6. All proactive output respects mute/quiet-hours/prefs and is deduped; the concierge is otherwise silent (no spam). Boost-gated features don't run on free trips.
