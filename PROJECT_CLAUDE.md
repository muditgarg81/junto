# Junto — System Blueprint & Migration Guide (For Claude)

This file contains the complete system blueprint, database schema, build instructions, and historical modifications for the **Junto (The Living Trip Plan)** project. Upload this file directly to a new Claude project or thread to immediately establish full context.

---

## 🛠️ 1. Technical Stack & Architecture

Junto is a hybrid progressive web and mobile application designed to turn group chats into structured, always-current itineraries.

* **Frontend**: Next.js 16.2.7 (using the App Router & Turbopack compiler) / React 19.
* **Styling**: Tailwind CSS & vanilla CSS transitions.
* **Mobile Shell**: Capacitor JS (wrapping the Next.js static export).
* **Database**: Serverless PostgreSQL (Neon DB).
* **AI Engine**: Google Gemini API REST client.

---

## 💾 2. Complete Database Schema Reference

The Neon Postgres database consists of the following key tables and relations:

```sql
-- trips: Group trip parent record
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'done')),
  base_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  invite_token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- members: Trip participants mapping to users
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'maybe', 'out')),
  roles TEXT[] NOT NULL DEFAULT '{}',
  auth_id VARCHAR(255) NULL, -- legacy compatibility
  upi_id VARCHAR(255) NULL,  -- legacy compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- user_sessions: Database-level revocable session store
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- messages: Chat thread logging
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  author_id UUID REFERENCES members(id) ON DELETE SET NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- itinerary_items: Scheduled timeline events (flight, stay, activity, etc.)
CREATE TABLE itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NULL,
  type VARCHAR(50) NOT NULL, -- 'flight', 'stay', 'activity', 'other'
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255) NULL,
  source_vault_item_id UUID NULL,
  starts_at TIMESTAMP WITH TIME ZONE NULL,
  ends_at TIMESTAMP WITH TIME ZONE NULL,
  tz VARCHAR(50) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- checklist_items: Packing and essentials checklist
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'personal' CHECK (category IN ('personal', 'shared')),
  assigned_to UUID NULL REFERENCES members(id) ON DELETE SET NULL,
  per_person BOOLEAN NOT NULL DEFAULT false,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- expenses: Shared trip expenses ledger
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  fx_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.0,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Other',
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  split_type VARCHAR(20) NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'shares', 'exact')),
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai-draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 3. Critical Codebase Rules & Design Quirks

When developing or refactoring, heeed these strict rules:

1. **Timezone-Safe Date Operations**:
   * *Do not* parse date strings directly with `new Date(ISO_String)` on Client components. It converts to the browser's local offset (e.g. EST shifts `2026-06-05` back to `2026-06-04T19:00:00-05:00`), causing Next.js SSR/CSR hydration errors.
   * *Always* parse date inputs by split components or pass explicit local variables, e.g.:
     ```typescript
     const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
     const dateObj = new Date(y, m - 1, d);
     ```
2. **Insecure context UUIDs**:
   * Standard browser `crypto.randomUUID()` fails in insecure HTTP environments (e.g., local Wi-Fi IP `http://192.168.1.17:3050`).
   * *Always* use the custom `generateUUID` function imported from `@/lib/uuid` for optimistic UI updates.
3. **HTML Hydration Overlay warnings**:
   * Mobile shells inject safe-area styles dynamically on `<html>`. The root layout tag in `app/layout.tsx` must maintain `suppressHydrationWarning`.
4. **Serverless Background Executions**:
   * Non-awaited backend promises are randomly terminated in serverless contexts. Wrap all background calls (such as the AI orchestrator) inside Next.js's native `after()` lifecycle callback inside API routes.

---

## 📱 4. Mobile Compilation & Native Deployment Manual

To compile changes and generate a fresh Android App Bundle (`.aab`) for Google Play Console:

### Step 1: Compile Next.js Web Assets
Run a clean Next.js static build in command prompt:
```bash
cmd /c npm run build
```
*Note: Next.js is configured for static exports; compiled static assets will sit inside the `out/` folder.*

### Step 2: Sync Web Assets to Android Shell
Export assets and sync plugin dependencies:
```bash
cmd /c npx cap sync
```
*This copies resources from `out/` to `android/app/src/main/assets/public`.*

### Step 3: Rebuild the Android App Bundle
Compile and sign the release package using Android Studio's JBR (Java 21):
```bash
cmd /c "set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr&& cd android && gradlew.bat clean bundleRelease"
```

* **Current Config**: `versionCode 23` / `versionName "3.0.2"` (configured in [build.gradle](file:///C:/claude/JUNTOFUN/android/app/build.gradle)).
* **Output Path**: `C:\claude\JUNTOFUN\android\app\build\outputs\bundle\release\app-release.aab`
* **Signing Key**: Signed automatically using the local release store configuration (`junto-release-key.jks`).

---

## 📖 5. Historical Enhancements Log

* **Roster Mentions**: Autocomplete tag menu triggered by `@` in [ChatClient.tsx](file:///C:/claude/JUNTOFUN/app/trip/[tripId]/chat/ChatClient.tsx). Supports full keyboard arrow navigation, enter/escape hooks, and mobile-friendly focus traps.
* **AI Cost Guards**: Bumps the ₹50 spending limit check to a daily resetting check of ₹100 for Standard tiers and ₹2000 for Boost tier.
* **Deterministic Concierge**: Intercepts common dining, sightseeing, weather, and proposal commands inside [ai-orchestrator.ts](file:///C:/claude/JUNTOFUN/lib/ai-orchestrator.ts) to eliminate Gemini API latency and save quotas.
* **Expirable Sessions**: Fully expirable/revocable database sessions validated on each server request, preventing session hijack or stale tokens.
