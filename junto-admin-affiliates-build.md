# Junto — Admin Affiliates Management (Build Brief)

> **For the Antigravity agent:** This fleshes out §4.7 (Partners & offers) of the admin-console brief. It **moves affiliate partner configuration out of static code/env and into a DB-backed model** edited from the console, so partners can be added, edited, re-weighted, and switched off **without a redeploy**. Same RBAC, audit log, and security rules as the admin console. Owner-only.

## 1. Why

Affiliate programs change all the time — new approvals, rate changes, underperformers, outages needing an instant kill switch. With config in `partners.config.ts` + env, each change is a code deploy. This page makes partner management a live operation.

## 2. Architecture change

- Introduce a DB-backed **`Partner`** model (below). The existing `partners.config.ts` becomes a **seed/migration**, not the source of truth.
- The offer-surfacing engine and `PartnerAdapter` registry read **active partners from the DB** at runtime, **cached** (e.g. 60s TTL). Edits take effect after cache refresh — no redeploy.
- Performance metrics are **derived** from existing `Offer` / `OfferClick` / `Conversion` rows grouped by partner.

## 3. Data model

```typescript
Partner {
  id; key; name;
  category: 'hotel'|'activity'|'insurance'|'esim'|'forex'|'transport'|'gear'|'photobook';
  network;                       // 'Travelpayouts','Impact','Amazon Associates', ...
  status: 'active'|'inactive';   // the kill switch
  affiliate_id;                  // marker/AID/tag — appears in URLs, OK in DB (mask in UI by default)
  secret_ref?;                   // pointer to a vault entry for any API KEY/secret — never store plaintext
  link_template;                 // with {id} and {sub} placeholders
  sub_param;                     // 'sub_id' | 'label' | 'ascsubtag' | ...
  commission_estimate;           // indicative %
  priority;                      // ordering when multiple partners share a category
  surface_triggers: string[];    // ['dates_locked','hotel_decision','flight_ingested', ...]
  updated_by; updated_at;
}
```

## 4. Credential security (important)

- **Affiliate IDs/markers/tags** (e.g. Travelpayouts marker, Booking AID, Amazon tag): appear in outbound URLs anyway → may live in the DB. Mask in the UI by default with a reveal toggle.
- **Secret API keys** (Viator key, partner API secrets): **never** store or display in plaintext. Keep in a secrets manager/vault; the `Partner` row holds only `secret_ref`. The UI shows "Key set ✓" and edits are **write-only** ("Replace key"), never read-back.
- Owner-only access. Every create/edit/enable/disable writes an `AuditLog` entry (who changed which partner, when).

## 5. The Affiliates management screen

Lives at `/admin/affiliates`. Capabilities:
- **List by category** — each partner row: name, network, status toggle, "ID set ✓/✗", commission, and this-period clicks / conversions / revenue.
- **Add / edit partner** (drawer): name, category, network, affiliate ID (masked), secret (write-only "Replace key"), link template, sub-param, commission estimate, priority, and a multi-select of surfacing triggers, plus the active toggle.
- **Kill switch** — disabling a partner (or a whole category) stops it surfacing immediately on next cache refresh.
- **Surfacing rules** — a view of which category surfaces on which trigger, and partner priority/weight within a category when several are active.
- **Link tester** — build a sample deep link from the template using a dummy `sub_id` and show/open it, to verify the link resolves before going live.
- **Performance** — per-partner funnel (offers surfaced → clicks → conversions → revenue) so you can spot underperformers.

### Stitch prompt (desktop, admin style — consistent with the console)
> Design an **admin Affiliates management** screen (desktop, left sidebar nav, neutral data-dense back-office style, pine/terracotta only as accents). A header with an "Add partner" button and a category filter. Partners grouped by category (Hotels, Activities, Insurance, eSIM, Forex, Transport, Gear, Photobooks); each row shows name, network, a status toggle (Active/Inactive), an "ID set" check, commission %, and this-period Clicks / Conversions / Revenue. A row click opens an **edit drawer**: fields for name, category, network, affiliate ID (masked with a reveal toggle), secret key (write-only, showing "Key set ✓" with a "Replace" button), link template, sub-param, commission, priority, a multi-select of surfacing triggers, an active toggle, and a "Test link" button that builds a sample deep link with a dummy sub-id. Professional, dense, trustworthy.

## 6. Acceptance criteria

1. An operator can add, edit, enable, and disable a partner from `/admin/affiliates`; changes take effect at runtime within the cache TTL — **no redeploy**.
2. Disabling a partner stops it surfacing offers immediately (after refresh).
3. Secret API keys are never displayed in plaintext; they're write-only and stored via `secret_ref`. Affiliate IDs are masked by default.
4. Per-partner performance (clicks, conversions, revenue) is visible.
5. The link tester produces a valid deep link carrying a `sub_id`.
6. The page is **owner-only**, and every change writes an `AuditLog` entry.
7. `partners.config.ts` is reduced to a seed; the live source of truth is the `Partner` table.
