# Junto — Profile Hub Expansion (Account, History, Chat Settings, Sharing)

Expands the profile into a hub with four new sections. Reuses the established design system. Continues the prompt lettering from the previous file (A–C).

---

## Profile menu — updated structure (the hub)

> Using the established design system, redesign the **Profile** screen as a hub. Top: large avatar + edit, name "Mudit Garg" in serif, "Edit" link. Then grouped navigation rows (icon + label + chevron):
> **You** — "Account & profile", "Your travels" (trip history).
> **Preferences** — "Chats", "Sharing & social", "Notifications".
> **Support** — "Help", "Privacy".
> A final "Log out" row in muted terracotta. Each row routes to the screens below.

---

## D. Account & profile (update + delete)

> Using the established design system, design an **account settings** screen titled "Account." Group one, editable rows (icon + label + current value + chevron): "Name — Mudit Garg," "Photo," "Email — muditgarg81@gmail.com," "Phone," "Home currency — ₹ INR," "UPI ID — mudit@okhdfc." Group two, "Security": "Sign-in method — Google," "Active sessions." Then a visually separated **Danger zone** at the bottom behind a thin terracotta divider: an "Export my data" row (download icon, subtext "Download your trips, expenses, and photos") and a "Delete account" row in terracotta text with subtext "Removes your profile. Past trips you shared stay visible to others as a former member." Keep the danger zone clearly set apart and calm, not alarming.

## E. Your travels (trip history)

> Using the established design system, design a **trip history** screen titled "Your travels" in serif. Top: a warm "travel passport" summary band with three serif stat blocks — "Trips 12," "Cities 9," "Days away 47." Below, a "Search trips" bar. Then a list grouped by year ("2026," "2025") of trip cards: each a compact row with a destination thumbnail, trip name + dates, a small member-avatar cluster, and a chevron to open it; completed trips show a small memories icon. Tapping opens that trip's archived view. Scrapbook-like, warm, inviting.

## F. Chats (settings, messaging-app style)

> Using the established design system, design a **chat settings** screen titled "Chats," modeled on a familiar messaging app. Group "Notifications": toggle "Message notifications" (on), toggle "Mentions only," row "Muted trips" (chevron, "2 muted"). Group "Media": "Auto-download" segmented Wi-Fi / Cellular / Never; toggle "Save to gallery." Group "Appearance": "Chat theme" with light/dark/paper swatches, "Font size" slider (Small–Large), and a small live chat-bubble preview reflecting the setting. Group "Privacy": toggle "Read receipts" (on), row "Archived chats." Clean grouped list with left icons, like a polished native settings screen.

## G. Sharing & social (journals, memories, photos)

> Using the established design system, design a **share** screen reached from a trip's memories / digital yearbook, titled "Share your trip." Dominant at the top: a preview of a beautifully designed shareable card in vertical story aspect — the journal cover with destination, dates, a hero photo, and a small Junto wordmark in the corner. Below: a segmented toggle for what to share — "Journal card," "Photo collage," "Single photos." Then a row of large round share targets with brand-correct icons: Instagram Stories, WhatsApp, Facebook, X, "Copy link," and "More." A "Shareable link" section with a toggle "Make this journal viewable by link" (OFF by default); when on, show a copyable link and a muted privacy note: "Anyone with the link can view. Photos of other trip members are included." Warm and visual, preview-led.

---

## Build & data notes (apply to the briefs)

### Account deletion (handle with care)
Hard-delete is unsafe in a money-tracking app. Implement as:
1. **Pre-check:** warn if the user has unsettled balances in any active trip; encourage settling first.
2. **Export option:** offer a data export (trips, expenses, photos) before deletion (DPDP/GDPR).
3. **Anonymize, don't orphan:** in shared trips, replace the user's name/avatar with "Former member" but **keep their expenses, splits, and messages** so others' ledgers stay intact.
4. **Erase personal data:** remove profile fields (name, photo, email, phone, UPI), revoke auth/sessions. This satisfies right-to-erasure without corrupting group data.

### Preferences model (global + per-trip, like WhatsApp)
```typescript
User   { ...; chat_prefs jsonb; }   // global: notifications, mentions_only, auto_download, theme, font, read_receipts
Member { ...; muted boolean; notif_level:'all'|'mentions'|'none'; }  // per-trip overrides
```
Per-trip mute/notif lives on `Member`; global defaults on `User.chat_prefs`. A trip's settings inherit the global unless overridden.

### Sharing implementation (the honest version)
- **No "post to feed" API** exists for personal Instagram/Facebook. Build: (a) server/client generation of a styled shareable asset (journal card image, collage, optional short video), (b) the **OS native share sheet** for any installed app, (c) the **Instagram Stories** share intent and WhatsApp share intent for one-tap targets, (d) an optional **public journal share link** (a read-only web view of the trip recap).
- **Consent/privacy:** group memories contain other people's photos. Default the public link **OFF**; warn that shared content includes others; consider a per-trip setting for who may share the album, and let members flag photos to exclude. Store a `TripShareLink { trip_id; token; enabled; created_by }` for the public view.

### New routes
```
/api/user/export/route.ts            → generate + download data export
/api/user/delete/route.ts            → anonymize-and-erase per above
/api/trip/[id]/share/route.ts        → generate shareable asset / toggle public link
/profile/account, /profile/travels, /profile/chats, /profile/sharing  (screens)
```
