# Junto — Checklist Reminders (Build Brief)

> **For the Antigravity agent:** Add periodic AI reminders for unchecked checklist items. **Privacy is a hard constraint, not a nicety** — read §1 first. Reminders are delivered **per-user through a private channel**, never the group chat/board. The reminder engine is a **separate delivery path** from the chat orchestrator and must NOT write to the `messages` table.

## 1. Privacy rules (hard constraints)

1. **Never broadcast personal items.** Items with `category='personal'` are never referenced in any group-visible surface — not the chat board, not a group notification, not an activity feed. Ever.
2. **Reminders are 1:1.** A reminder reaches only the member it concerns, via push + a personal in-app reminders area. It is never posted to `messages` or shown to other members.
3. **Shared-gear nudges default to private too.** A reminder about an unchecked `shared_gear` item goes privately to the **responsible member** (`assigned_to`). Do not name a lagging person in the group. If any group-visible packing status is shown at all, it must be a neutral aggregate ("3 of 5 shared items ready") with **no names and no personal items** — no shaming.
4. **Reminder engine ≠ chat orchestrator.** They are separate code paths. The reminder engine writes to a per-user notification store, never to the group chat.

## 2. Reminder engine

- A **scheduled job** (Vercel Cron / Supabase scheduled function / queue) runs on a cadence (e.g. daily).
- For each active trip approaching departure, for each member, gather **that member's own** unchecked items: their `personal` items + `shared_gear` items where `assigned_to = them`.
- If they have outstanding items, are within the reminder window, are **not muted**, and it's outside quiet hours → send one private reminder listing **only their own** items.
- **Cadence escalates toward departure** (e.g. ~7 days out, ~2 days out, day-before) and stops for any item once it's checked. Don't re-send the same nudge within a cycle.
- **Respect preferences:** honor `User.chat_prefs` notification settings and the per-trip `Member.muted` / `notif_level` from the profile patch. `none`/muted → no reminders. Respect quiet hours in the user's timezone.

## 3. Delivery channel

- **Push notification** (web push / FCM) + a **personal in-app "Reminders"** surface (visible only to that user).
- **Do not** create a `messages` row, an AI chat interjection, or any group artifact for a reminder.

## 4. Message composition

- **Default: templated**, to keep per-user cost near zero at scale — e.g. *"2 things still to pack for Goa (2 days away): toiletries, your share of the speaker."*
- **Optional light AI personalization** (warm tone) — keep it cheap and private:
```
Compose a short, warm, PRIVATE reminder to {name} about their own unchecked trip items
before {tripName} ({daysUntil} days away). Items: {their items only}.
- One or two friendly sentences. Never mention other people's items or names. Never shame.
```

## 5. Data model / tracking

- Add a per-member reminder state to avoid duplicate pings, e.g. `ChecklistItem.last_reminded_at` or a small `reminders` log (`member_id`, `trip_id`, `sent_at`, `item_ids`).
- Reuse notification prefs already on `User.chat_prefs` and `Member` (muted / notif_level).

## 6. Acceptance criteria

1. A member with unchecked items receives a **private** reminder (push + personal in-app) listing **only their own** items; no other member can see it.
2. **No `personal` item ever appears** in the chat board, group notifications, or any group-visible surface — verified by inspecting that the reminder engine never writes to `messages`.
3. Shared-gear reminders go privately to the responsible member; any group packing status is a nameless aggregate with no personal items.
4. Muted members/trips and out-of-quiet-hours times receive **no** reminder; checked items stop generating reminders.
5. The same item isn't re-reminded within a single cadence cycle; cadence escalates toward departure.
