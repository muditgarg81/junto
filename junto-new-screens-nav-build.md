# Junto — New Screens & Navigation Build Brief

> **For the Antigravity agent:** Extends `junto-antigravity-build.md` and the profile/onboarding patches. This batch wires in four new screens from the updated Stitch bundle (`stitch_tripmate_travel_companion__1_/`) and resolves where the Checklist and Local Info screens live in the app's navigation. Same stack, tokens, and guardrails. Run + verify after the tasks below.

## New assets (this bundle)

Unzip into `/design-reference/` (tokens unchanged — same `wandertogether/DESIGN.md`). Rebuild each as a real component matching its `screen.png`:
- `account_settings/` — user-level
- `trip_history/` — user-level
- `essentials_checklist/` — trip-level
- `local_info/` — trip-level (emergency info)

## Screen → route & placement

| Screen | Route | Reached from |
|---|---|---|
| account_settings | `/profile/account` | Profile hub → "Account & profile" |
| trip_history | `/profile/travels` | Profile hub → "Your travels" |
| essentials_checklist | `/trip/[id]/checklist` | **Plan hub tile** "Essentials" |
| local_info | `/trip/[id]/local-info` | **Plan hub tile** "Local info" + **persistent app-bar shield** |

## Navigation / information architecture (the accommodation)

**Keep the bottom tab bar at four tabs:** Chat, Plan, Money, Vault. Do not add a fifth tab.

**1. Plan becomes the trip hub.** On `/trip/[id]/plan`, below the Decided/Open decision sections, add a "Trip resources" row of quick-access tiles linking to the secondary trip screens: **Itinerary, Essentials (checklist), Local info, Memories**. These derive from or relate to the plan, so they belong here, and this gives discoverable access without crowding the nav.

**2. Emergency / Local info gets a persistent shortcut.** Because crisis access must be instant and work offline, in addition to the Plan tile, pin a small **shield/SOS icon in the trip app bar** (top-right), visible on every `/trip/[id]/*` screen, that opens `/trip/[id]/local-info`. Cache this page (emergency numbers, nearest hospital, embassy) for **offline** use — it must render with no connection.

**3. Checklist** lives only as the Plan-hub tile (no app-bar shortcut needed); it's a pre-trip activity. The AI may optionally surface a checklist nudge in chat (e.g. "want a starter packing list for a beach trip?"), deep-linking to `/trip/[id]/checklist`.

## Component notes
- `PlanResourceTile` — icon + label tile, used in the Plan "Trip resources" row.
- `EmergencyShieldButton` — app-bar icon present across trip screens; route to local-info.
- Local-info page: offline-cached (service worker / local store); show a small "saved offline" indicator.

## Build tasks
1. Build the four screens as components on the design tokens; match each `screen.png` (light + dark).
2. Wire `account_settings` and `trip_history` into the Profile hub routes.
3. Add the "Trip resources" tile row to the Plan screen → Itinerary, Essentials, Local info, Memories.
4. Add the persistent `EmergencyShieldButton` to the trip app-bar layout; route to local-info.
5. Make local-info offline-available and verify it renders with the network disabled.

## Data-model dependencies (already specified in prior briefs)
- `account_settings` / `trip_history` depend on the **User/Member split** and `chat_prefs` (profile/onboarding patch).
- Account deletion follows the **anonymize-don't-orphan** flow.
- `essentials_checklist` uses `ChecklistItem`; `local_info` is generated for the locked destination and cached.

## Acceptance criteria
- All four screens render on the tokens, light + dark, matching their `screen.png`.
- The Plan screen shows resource tiles that open Itinerary, Checklist, Local info, and Memories.
- The emergency shield is reachable from every trip screen in one tap and the Local info page loads with the network disabled.
- Checklist and Local info are reachable without adding a fifth bottom tab.
