# Google Stitch Prompts — Trip Companion ("Wandertogether")

Stitch takes plain-English screen descriptions and generates mobile UI you can refine and export to Figma/code. Two tips before you start:

1. **Set the design system once.** Paste the *Design System* block below into your first prompt (or Stitch's style/theme settings if available), then start each screen prompt with *"Using the established design system,"* so all screens stay cohesive.
2. **One screen per prompt.** Generate them individually, iterate, then assemble. Treat copy below as placeholder — Stitch will render it literally, which is what you want for a realistic mockup.

---

## Design System (paste first / reuse)

> Design a mobile app called **Wandertogether**, a warm, editorial travel-planning app. Aesthetic: refined, friendly, slightly analog — like a beautifully designed travel journal, not a generic SaaS app.
>
> **Colors:** warm off-white paper background (#F2ECE0), near-black ink text (#211F1A), muted secondary text (#5E594E). Primary brand color deep pine green (#1F4D3F) for confirmed states and primary buttons; terracotta (#C2592F) for accents, open items, and alerts; muted gold (#B98A3C) for tertiary/"maybe" states. Cards are soft cream (#FCFAF4) with thin warm-grey borders and gentle soft shadows.
>
> **Typography:** a characterful serif (Fraunces or similar) for headings and big numbers; a clean humanist grotesk (Hanken Grotesk or similar) for body and labels. Generous spacing, rounded corners (14–18px), tabular numbers for money.
>
> **Layout:** mobile, 390px wide. Bottom tab bar with four tabs — Chat, Plan, Money, Vault — pine green for the active tab. Status bar at top. Avoid generic AI aesthetics, purple gradients, and stock-photo clutter.

---

## 1. Welcome / Create or Join

> Using the established design system, design the **welcome screen**. A warm paper background with a soft gradient wash in the top-right (peach) and bottom-left (sage). Large serif logo "Wander**.**together" centered upper-third, the dot in terracotta. A one-line tagline below: "One living plan for the whole group." Two stacked buttons mid-screen: a pine-green primary button "Start a trip" and a ghost outlined button "Join with a link." Small footer text: "No app needed for friends you invite." A subtle hand-drawn dotted travel-route line as a background flourish.

## 2. Create Trip (setup)

> Using the established design system, design a **create-trip form screen**. App bar with back arrow and title "New trip" in serif. Fields stacked as soft cream cards: a large text input "Trip name" (placeholder "Goa · January"), a destination input with a small map-pin icon, an optional date-range picker showing "Add dates later" as a skip option, and a base-currency selector defaulting to "₹ INR." A pine-green full-width button at the bottom "Create & get invite link." Keep it calm and uncluttered.

## 3. Invite / Roster

> Using the established design system, design a **members/roster screen** titled "Who's in." At the top, a prominent invite card: a copyable invite link in a pill with a "Copy link" button and a "Share" icon. Below, a section "Going" listing members as rows with circular colored-initial avatars and names, each with a small pine-green dot — Mudit, Vriti, Aditi, Karan. A "Maybe" section with Riya, marked with a gold dot and the label "maybe." An "Invited · not responded" section with one greyed entry. Each member row has a tiny role tag where relevant ("organizer", "treasurer"). Bottom tab bar present, no tab active (this is a sub-screen).

## 4. Chat Lane (the hero screen)

> Using the established design system, design the **group chat screen** — the app's hero. App bar: serif trip title "Goa · January", subtitle "4 going · 1 maybe", and an overlapping cluster of 4 circular initial-avatars on the right. Chat body with a centered "Today" divider. Show incoming message bubbles (cream, left-aligned, with small sender name above): Vriti "can we just lock dates already", Aditi "same, that week's good". One outgoing bubble (pine green, right-aligned): "jan 15–20 works for me".
>
> Then an **AI message** styled distinctly — a soft sage-tinted card spanning full width with a small pine "AI" badge: "Looks like Jan 15–20 works for 3 of you. Want me to make it a proposal?" with a pine-green button "Make it a proposal."
>
> Below that, an inline **proposal card** with a terracotta border: a small uppercase tag "PROPOSAL · DATES", a serif heading "Jan 15 – 20, 2026", subtext "Proposed by Mudit · open for votes", a segmented progress bar (3 of 4 segments filled pine), text "3 confirmed · 1 pending", two buttons "Confirm" (pine) and "Object" (ghost), and a small nudge line "Riya hasn't voted. Nudge →" in terracotta. A message input bar at the bottom above the four-tab nav, Chat tab active.

## 5. Proposal Detail / Voting

> Using the established design system, design a **proposal detail screen**. App bar back arrow + title "Proposal". A large card: uppercase terracotta tag "DATES", serif heading "Jan 15 – 20, 2026", proposer line "Mudit · 2h ago". A pine-tinted **AI note** strip with an "AI" badge: "Looks clean — no conflicts with anything locked." Then a vote tally section listing each member as a row with avatar, name, and a vote chip: Mudit "Confirmed" (pine), Vriti "Confirmed" (pine), Aditi "Confirmed" (pine), Riya "Pending" (grey). A horizontal segmented bar showing 3/4. Two large bottom buttons: "Confirm" (pine, full width) and "Suggest a change" (ghost). A footer line: "Locks automatically when everyone confirms."

## 6. Plan View (trip state)

> Using the established design system, design the **plan overview screen** titled "The plan" in serif, subtitle "Goa · 4 going · 1 maybe". A section labeled "DECIDED" with cards, each a row with a left icon tile (sage background), a bold title, a small subtitle, and a pine-green circular checkmark on the right: "Jan 15 – 20 / Dates · locked unanimously" and "Goa / Destination · locked". A section labeled "OPEN" with terracotta-accented rows showing a pill instead of a checkmark: "Hotel / 2 options · voting now" with a "3 voted" pill, and "Budget band / Proposed · ₹18–22k each" with a "Vote" pill. A "WHO'S IN" section at the bottom with small rounded member chips, each with a colored dot (pine for going, gold for "maybe"). Four-tab nav, Plan tab active.

## 7. Money / Balances & Settle-up

> Using the established design system, design the **money screen** titled "Money", subtitle "₹26,400 spent · 5 people". At the top, an **AI draft card** (sage-tinted, "AI" badge): "From chat — 'I paid 4000 for the cab'. Log it, split 3 ways?" with two buttons "Log expense" (pine) and "Edit" (ghost). A "BALANCES" section: rows with avatar + name + amount, using pine green for positive ("Mudit +₹2,400") and terracotta for negative ("Vriti −₹1,600", "Aditi −₹800"), tabular numbers. A prominent **settle-up card** in solid pine green with cream text: header "SETTLE UP · 2 TRANSFERS", then two transfer rows "Vriti → Mudit · ₹1,600" and "Aditi → Mudit · ₹800", each with a small cream "Pay · UPI" button. Below, a "RECENT" expense row "Cab to hotel / Mudit paid · split 3 ways / ₹4,000". Four-tab nav, Money tab active.

## 8. Add Expense

> Using the established design system, design an **add-expense screen**. App bar "Add expense" with a back arrow and a "Save" text button. A large amount input at the top, serif, with a "₹" prefix (showing "4,000"). A description field ("Cab to hotel") and a category selector chip row (Food, Transport, Stay, Activity, Other) with Transport selected in pine. A "Paid by" selector showing Mudit's avatar. A "Split" section with a segmented control: Equally / Shares / Exact (Equally selected). Below it, a list of members with checkboxes and their computed share — Mudit ✓ ₹1,333, Vriti ✓ ₹1,333, Aditi ✓ ₹1,334, Karan unchecked, Riya unchecked — demonstrating a partial split. A small caption: "Only people you check are included." Full-width pine "Save expense" button.

## 9. Vault (bookings & contacts)

> Using the established design system, design the **vault screen** titled "Vault", subtitle "Bookings, vouchers & contacts". A large dashed-border upload card at the top: "Forward bookings to goa-trip@wandertogether.app or tap to upload" with a small upload icon. Then grouped sections. "FLIGHTS": a card with an airplane icon, "IndiGo 6E-235 / Mumbai → Goa · Jan 15, 6:10 AM / PNR XK4P2Q". "STAYS": a card "Taj Holiday Village / Check-in Jan 15 · Check-out Jan 20 / Conf #88241". "ACTIVITIES": "Scuba — Grand Island / Jan 17, 9:00 AM / Voucher GI-7782". "CONTACTS": compact rows with a phone icon — "Driver · Suresh +91 98xxxxxxx", "Hotel front desk". Each card has a small thumbnail chip indicating the source document. Four-tab nav, Vault tab active.

## 10. Voucher Extraction Confirm

> Using the established design system, design a **voucher confirmation screen** — the moment after the AI reads an uploaded document. App bar "Confirm details". At the top, a thumbnail of the uploaded hotel voucher. Below, a sage-tinted AI strip: "I read this hotel voucher — please check the dates." Then editable field rows in cream cards: "Hotel / Taj Holiday Village", "Check-in / Jan 15, 2026", "Check-out / Jan 20, 2026", "Confirmation / 88241". The **check-in date field is highlighted with a terracotta border and a small warning chip "Please verify — date format was ambiguous"**. A full-width pine "Add to vault & itinerary" button, with a ghost "Edit manually" link below. This screen should make the date-verification moment feel central and reassuring.

## 11. Itinerary (day-by-day timeline)

> Using the established design system, design an **itinerary timeline screen** titled "Itinerary", subtitle "Jan 15 – 20 · Goa". A vertical timeline with a thin connecting line on the left and day headers in serif. "DAY 1 · JAN 15": a travel node "Flight to Goa · 6:10 AM" (airplane icon), a stay node "Check in · Taj Holiday Village · 2:00 PM" (building icon). "DAY 3 · JAN 17": an activity node "Scuba diving · Grand Island · 9:00 AM" (wave icon). Each node is a small card with a colored icon tile, a title, a time, and a tiny "from voucher" tag linking to the source. Show one node with a subtle terracotta flag "Tight connection — 40 min" to demonstrate AI conflict-flagging. Calm, lots of vertical breathing room. Four-tab nav (this can live under Plan).

## 12. Checklist (packing & essentials)

> Using the established design system, design a **checklist screen** titled "Essentials", subtitle "8 of 14 packed". A segmented filter at top: "Everyone / Mine / Shared gear". A progress bar in pine. Grouped checklist sections with circular checkboxes (checked ones filled pine with a white tick): "SHARED GEAR" — "Bluetooth speaker (Karan)", "First-aid kit (Aditi)", "Power bank ✓". "PERSONAL" — "Sunscreen ✓", "Swimwear ✓", "Passport / ID". Checked items have a strikethrough and reduced opacity. A small AI suggestion chip at the bottom: "AI: add insect repellent for a beach trip?" with a "+ Add" button. A floating "+" button to add an item.

## 13. Emergency / Local Info

> Using the established design system, design an **emergency info screen** titled "Local info", subtitle "Goa, India · saved offline". A prominent terracotta-bordered card at top: "Emergency · 112" with a large "Call" button. Below, a list of cards with icons: "Police · 100", "Ambulance · 108", "Nearest hospital · Manipal Hospital, Dona Paula · 4.2 km" with a "Directions" button, "Tourist helpline · 1363". A small footer note with an offline icon: "Cached for offline — works without signal." Keep it clean, calm, and high-contrast for legibility in a stressful moment.

---

## Suggested generation order

Lead with **#4 Chat Lane** and **#6 Plan View** — they carry the product's identity, and getting their style right makes the rest fall in line. Then #7 Money and #10 Voucher Confirm, which show the AI-drafts-human-confirms pattern that defines the app. The remaining screens are variations on the established components, so they'll come quickly once the first four look right.
