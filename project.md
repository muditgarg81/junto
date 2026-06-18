# Junto Project Context & Migration Log

This file serves as a comprehensive context package containing the complete history of architectural improvements, feature implementations, and bug fixes applied to **Junto (The Living Trip Plan)**. Load this file into any LLM session (such as Claude) to restore full context on the codebase state.

---

## 🚀 1. Feature Additions & Enhancements

### A. Roster Mention Autocomplete Dropdown
* **Location**: [ChatClient.tsx](file:///C:/claude/JUNTOFUN/app/trip/[tripId]/chat/ChatClient.tsx)
* **Behavior**: Detects `@` character typed in the chat input area. Matches the query case-insensitively against active members (e.g. typing `@v` filters to names containing "v" like Vriti) and the AI Assistant (`@ai`).
* **Keyboard Controls**: Uses standard accessibility controls (`ArrowDown` / `ArrowUp` to navigate list options, `Enter` to select, and `Escape` to close). Retains focus inside the input box using `onMouseDown` preventDefault patterns.
* **Styling**: Floating card container positioned above the input using warm theme tokens, complete with a slide-up fade-in entry animation (`.mention-popup-bounce`).

### B. Deterministic AI Concierge & Proposal Generator
* **Location**: [ai-orchestrator.ts](file:///C:/claude/JUNTOFUN/lib/ai-orchestrator.ts)
* **Goal**: Minimize latency and preserve Gemini API call quotas by handling high-probability queries locally.
* **Deterministic Interceptors**:
  1. **Dining Recommendations**: Intercepts words like `eat`, `food`, `restaurant`, `cafe` etc. and outputs localized culinary highlights for Goa, Paris, Venice, Rome, and Kanha.
  2. **Sightseeing Attractions**: Intercepts words like `visit`, `explore`, `sightsee`, `things to do` etc. and recommends top spots.
  3. **Emerging Proposal Matchers**: Intercepts phrases like *"lets plan for Dudhsagar Falls"* or *"Dudhsagar Falls tomorrow"*, dynamically drafting a custom decision card with yes/no/maybe voting options without any LLM latency.

### C. Graceful API 429 Rate-Limit Fallbacks
* **Location**: [ai-orchestrator.ts](file:///C:/claude/JUNTOFUN/lib/ai-orchestrator.ts)
* **Behavior**: If the Gemini LLM API fails (e.g. rate-limited 429 errors) and the message explicitly tags `@ai` or `assistant`, the orchestrator catches the error and inserts an interactive help block listing offline commands (Weather, Checklist, Expenses, local emergency contacts).

### D. Secure Document Voucher Storage
* **Voucher Upload**: [voucher/route.ts](file:///C:/claude/JUNTOFUN/app/api/trip/[tripId]/voucher/route.ts)
* **File Streaming Retrieval**: [route.ts](file:///C:/claude/JUNTOFUN/app/api/trip/[tripId]/vault/file/[fileName]/route.ts)
* **Security Model**: Uploads are stored in a private `uploads/` folder (outside the public static root). Files are streamed back only after validating the user's session and verifying that they are a member of the trip associated with the voucher.

---

## 🛡️ 2. Security & Session Architecture

### A. Travels Page Isolation
* **Location**: [page.tsx](file:///C:/claude/JUNTOFUN/app/profile/travels/page.tsx)
* **Behavior**: Filters database queries to retrieve only the trips where the logged-in user is a member, preventing information leakage. Unauthenticated users are redirected back to the `/signin` screen.

### B. Dynamic 401 Auth Redirection
* **Location**: All 10 subpages under `app/trip/[tripId]/` (`plan`, `chat`, `checklist`, `invite`, `itinerary`, `local-info`, `money`, `upgrade`, `vault`, and `metrics`).
* **Behavior**: Standardized `401` handler redirections to pass the current route parameter: `/signin?redirect=/trip/[tripId]/[subpage]`. This guarantees the user returns to their active screen immediately after logging in.

### C. Revocable & Expirable Database Sessions
* **Location**: [auth.ts](file:///C:/claude/JUNTOFUN/lib/auth.ts) & [actions.ts](file:///C:/claude/JUNTOFUN/app/profile/actions.ts)
* **Structure**: Created `user_sessions` table in Neon Postgres. Logins assign an `expiresAt` timestamp and generate a `sessionId` recorded in the DB. Verification checks DB validity. Sign-outs cleanly revoke and delete the session record.

### D. AI Spending Cost Guard
* **Location**: [ai-orchestrator.ts](file:///C:/claude/JUNTOFUN/lib/ai-orchestrator.ts)
* **Behavior**: Refactored the ₹50 spending limit check from a lifetime limit (which blocked the AI permanently) to a daily resetting check. Bumps the daily limit based on tier:
  * Standard Trip: **₹100.00 INR**
  * Boost Upgraded Trip: **₹2000.00 INR**

---

## 🐛 3. Critical Bug & Hydration Fixes

### A. Next.js Hydration Timezone Offset Mismatches
* **Location**: [YourTripsClient.tsx](file:///C:/claude/JUNTOFUN/app/(marketing)/YourTripsClient.tsx), [ItineraryClient.tsx](file:///C:/claude/JUNTOFUN/app/trip/[tripId]/itinerary/ItineraryClient.tsx), and [MoneyClient.tsx](file:///C:/claude/JUNTOFUN/app/trip/[tripId]/money/MoneyClient.tsx)
* **Problem**: Instantiating dates via `new Date("YYYY-MM-DD")` evaluates in UTC on the server but shifts back a day in negative local timezone offsets (e.g. UTC-5 EST) on the client, triggering hydration errors.
* **Fix**: Replaced dynamic timezone conversions with timezone-agnostic components parsing (string splitting or local integer parameters like `new Date(year, monthIndex, day)`).

### B. Suppressed Safe-Area Layout Warnings
* **Location**: [layout.tsx](file:///C:/claude/JUNTOFUN/app/layout.tsx)
* **Problem**: Capacitor WebViews and browser extensions dynamically inject safe-area variables (e.g. `style="--safe-area-inset-top: 0px;"`) into the root `<html>` tag, causing Next.js SSR/CSR mismatches.
* **Fix**: Appended `suppressHydrationWarning` to the `<html>` element.

### C. Touch-Screen Checklist Delete Visibility
* **Location**: [ChecklistClient.tsx](file:///C:/claude/JUNTOFUN/app/trip/[tripId]/checklist/ChecklistClient.tsx)
* **Problem**: Delete trash buttons were only visible using `group-hover:opacity-100`. Mobile touch screen interfaces lack pointer hover, leaving the delete button permanently hidden.
* **Fix**: Removed hover opacity transitions, making the delete action permanently visible on both personal and shared checklist sections.

### D. Non-Secure Context UUID Fallback
* **Location**: [uuid.ts](file:///C:/claude/JUNTOFUN/lib/uuid.ts) (Imported in Chat, Plan, and Checkout client components).
* **Problem**: `crypto.randomUUID()` is missing in browsers when running on non-secure connections (e.g., local Wi-Fi IP `http://192.168.1.17:3050`), causing chat sends and plan interactions to crash.
* **Fix**: Added a fallback UUID v4 generator utilizing `Math.random` when `window.crypto.randomUUID` is unavailable.

---

## 🛠️ 4. Serverless Warmth Optimization

### A. Next.js background execution lifecycle
* **Location**: [route.ts](file:///C:/claude/JUNTOFUN/app/api/trip/[tripId]/message/route.ts)
* **Problem**: In serverless hosting (Vercel), un-awaited background promises running the AI Orchestrator were terminated mid-execution as soon as the main thread returned the HTTP response.
* **Fix**: Wrapped background execution calls in Next.js's native `after()` lifecycle callback, ensuring serverless processes stay warm until the orchestrator completes database state modifications.

---

## 📱 5. Mobile Native Compilation

* **Capacitor Configuration**: Copies compiled web contents from the `out/` static export directory.
* **Gradle Target Build Parameters**:
  * **Java Home**: `C:\Program Files\Android\Android Studio\jbr` (OpenJDK 21.0.10)
  * **Version Code**: `23`
  * **Version Name**: `3.0.2`
* **Release Artifact Location**: [app-release.aab](file:///C:/claude/JUNTOFUN/android/app/build/outputs/bundle/release/app-release.aab) (Signed with local release key `junto-release-key.jks`)
