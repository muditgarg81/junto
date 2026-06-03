# Junto — Fix "Trip Economics" placement + add user-facing Trip Cost Summary

> Two things: (1) the "Trip Economics" card is **internal operator analytics** mistakenly shown to users — remove it from user screens and gate it to owner-only; (2) build a proper **user-facing trip cost summary** in the Money tab for the legitimate "help users understand the trip's cost" need.

## Part 1 — Remove "Trip Economics" from the user-facing Plan (fix)

The card currently on `/trip/[id]/plan` ("View aggregate API costs, click funnels & upgrade commissions") is the **unit-economics dashboard from the monetization brief §9** — your LLM/API cost per trip, the affiliate click→conversion funnel, and commission + boost-upgrade revenue. This is **operator-only** business data.

- **Remove** the Trip Economics card from `/trip/[id]/plan` (and any other user-facing screen).
- **Move** the dashboard to an **owner-only** route, e.g. `/admin/economics`, gated so it renders **only** for the app-operator account — never for trip members.
- **Why:** it exposes your cost structure and the fact that bookings earn you commission. Surfacing that to users is confusing and erodes the trust the model depends on.

## Part 2 — Build a user-facing "Trip costs" summary (Money tab)

This is what a *user* actually wants when they think "what's this trip costing us." It shows only the group's own money — no API costs, no funnels, no commissions.

### Placement
A "Trip costs" / summary view in the **Money** tab (e.g. a segmented toggle at the top of Money: "Expenses | Summary", or a "View summary" header link). Not on Plan.

### Stitch prompt
> Using the established design system, design a **trip cost summary** screen in the Money section, titled "Trip costs" in serif, subtitle "Goa · Jan 15–20 · 5 people." A hero band with three serif stat blocks: "Total ₹26,400," "Per person ₹5,280," and "Your balance −₹1,600" (terracotta if they owe, pine if they're owed). A "BUDGET" card showing the agreed band "₹18–22k per person" with a progress bar of actual-per-head against it, labelled "₹5,280 of ₹20,000 used" in pine (comfortably under). A "WHERE IT'S GOING" section with category rows, each a small horizontal bar + percentage + amount: Stay 45%, Transport 25%, Food 20%, Activities 10%. A "PER PERSON" section listing each member with avatar, name, and paid-vs-share (e.g. "Mudit · paid ₹8,000 · share ₹5,280"). A footer card "Settle up · 2 transfers →" linking to the existing settle flow. Calm, transparent, all about the group's own money.

### Data (all already in the model — no new business data)
- Total = Σ expenses; per-person = total ÷ members; your balance from the ledger.
- Budget band from the locked `budget` Decision; actual-per-head vs that band.
- Category breakdown from `Expense.category`.
- Per-person paid-vs-share from `Expense` + `Split`.
- Settle-up reuses `lib/settle.ts`.

## Acceptance criteria
1. "Trip Economics" no longer appears on the Plan screen or any trip-member screen.
2. The economics/metrics dashboard is reachable **only** by the operator/owner account.
3. The Money tab has a "Trip costs" summary showing total, per-person, budget-vs-actual, category breakdown, and per-person paid-vs-share — with **no** API cost, funnel, or commission data anywhere user-facing.
