# Junto — Security Remediation Build Brief

> **For the Antigravity agent:** This remediates the findings in the architecture & security audit **plus** issues the audit missed. Do **P0 first** — until P0 is done, the app has effectively no authentication and exposes every user's data. The real-auth piece is shared with `junto-auth-routing-patch.md`; do them together. After each priority tier, verify against §Acceptance.

## Root cause

Gaps A–D are one problem: the server trusts the client to declare identity and authorization. Identity is a forgeable plaintext cookie, role is read from a client cookie, the actor comes from the request body, and there's a backdoor to the operator account. Two changes collapse almost all of it: (1) a **real signed session**, and (2) a **single server-side authorization helper** used on every trip-scoped route.

---

## P0 — Ship-blockers (no real auth exists until these are done)

### P0.1 — Real signed sessions (fixes Gap A; enables real logout)
- Replace the plaintext `junto_user_id` cookie with a **signed, httpOnly session** (Supabase Auth per the auth patch, or signed JWT / iron-session).
- The session value is **never** the raw `users.id`; it's a signed token whose subject is verified server-side.
- All auth cookies: `httpOnly: true`, `secure: true`, `sameSite: 'lax'`.
- Logout invalidates the session server-side (and clears the cookie), so a leaked old cookie stops working.

### P0.2 — Remove the operator backdoor (fixes Gap D)
- Delete the `getCurrentUser` fallback to `auth_id = 'default-mudit-garg'`. If a dev fallback is unavoidable, gate it to `process.env.NODE_ENV === 'development'` **and** return a disposable dev user — **never the real owner profile**.

### P0.3 — Central authorization helper on every trip-scoped route (fixes Gaps B, C, and the read-side IDOR the audit missed)

```typescript
// lib/authz.ts
export async function authorizeTripAccess(
  tripId: string,
  opts?: { role?: 'organizer' }
): Promise<{ user: User; member: Member }> {
  const user = await getCurrentUser();                 // verified session only
  if (!user) throw new HttpError(401);
  const member = await db.members.findFirst({ where: { trip_id: tripId, user_id: user.id } });
  if (!member) throw new HttpError(404);               // not a member → cannot read or write
  if (opts?.role && !member.roles.includes(opts.role)) throw new HttpError(403);
  return { user, member };
}
```

- Call it at the top of **every** trip-scoped handler — **reads included**: `/api/trip/[tripId]/sync`, every Server Component that pre-renders trip data, and every mutation route. The audit only checked mutations; the `/sync` and read paths are the bigger exposure (any user could read any trip by changing `tripId`).
- **Never** read role/identity from the `junto_member_[tripId]` cookie for authorization — that cookie is a UX hint only.
- **Actor identity comes from `member.id`**, never from the request body. Strip/ignore `proposedBy`, `paid_by`, `assigned_to`, vote `member_id`, etc. from incoming payloads and set them from the authorized member.

---

## P1 — High

### P1.1 — Stored XSS (audit missed; compounds Gap A)
- Audit every render path for user content (`messages.body`, names, JSONB `payload`/`metadata`). No `dangerouslySetInnerHTML` on user content; if rendering markdown, sanitize (e.g. DOMPurify or a safe renderer). With httpOnly now true (P0.1), this removes the session-theft chain.

### P1.2 — Invite-token entropy (audit missed)
- Generate `trips.invite_token` with ≥128 bits of CSPRNG randomness. The token only lets someone *request to join* (creates a `member`); it must not grant data access without membership (enforced by P0.3). Add optional expiry/rotation.

### P1.3 — CSRF (Gap E)
- Move state mutations to **Server Actions** (built-in CSRF protection) where possible. For remaining API routes, enforce `Origin`/`Sec-Fetch-Site` checks; `sameSite: 'lax'` from P0.1 already closes most vectors.

---

## P2 — Then

### P2.1 — Rate limiting & LLM cost protection (audit missed)
- Rate-limit message posting, the `/sync` polling endpoint, and the AI path per user/IP (e.g. Upstash ratelimit in middleware). For an AI app the specific risk is **inference cost-DoS** from message spam. Confirm the "default to silence" pre-filter gates trivial messages **before** any LLM call, and add a per-trip LLM spend cap.

### P2.2 — Prompt-injection guard (audit missed)
- Treat all chat and voucher text as untrusted. Keep it in user-role messages, never concatenated into system instructions. **Strictly validate** the AI's JSON output against a schema (zod). AI output may only create **drafts/proposals**; it must **never** directly set a `decision` to `locked` or commit an expense — those stay human-confirmed.

### P2.3 — Secrets hygiene (audit missed)
- Audit for any `NEXT_PUBLIC_`-prefixed secret (Gemini key, DB string, partner keys) — that prefix ships the value to the browser. Move all secrets server-side.

### P2.4 — Partner postback signatures (if monetization is built)
- Verify a signature/shared secret on `/api/partners/[partner]/postback` so conversions can't be forged for affiliate fraud.

---

## Acceptance criteria

1. Setting the session cookie to a different known UUID grants **no** access (signature required).
2. A non-member gets **404/403** on `/api/trip/[tripId]/sync` and every trip read/write route.
3. Editing `junto_member_[tripId]` to `role: organizer` does **not** grant organizer powers (role comes from DB).
4. Mutations ignore actor UUIDs in the request body; actions are attributed to the session member.
5. The `default-mudit-garg` fallback returns nothing outside development.
6. Logout invalidates the session — reusing the prior cookie fails.
7. A cross-origin POST to a mutation route is rejected.
8. User content never renders unescaped; no `NEXT_PUBLIC_` secret appears in the client bundle.
9. Flooding the message/sync endpoints returns 429; the LLM is not called for trivial messages.
10. The AI cannot lock a decision or commit an expense without human confirmation.
