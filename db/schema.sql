-- PostgreSQL Schema DDL for Junto (Travel Companion)
-- Target: Neon Serverless Postgres

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'done')),
  base_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  invite_token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'maybe', 'out')),
  roles TEXT[] NOT NULL DEFAULT '{}',
  auth_id VARCHAR(255) NULL,
  upi_id VARCHAR(255) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  author_id UUID REFERENCES members(id) ON DELETE SET NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('dates', 'destination', 'hotel', 'budget', 'logistics', 'custom')),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'rejected')),
  resolved_option_id UUID NULL, -- Add constraint later after option table is created
  created_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Apply foreign key to decisions for resolved_option_id
ALTER TABLE decisions ADD CONSTRAINT fk_resolved_option FOREIGN KEY (resolved_option_id) REFERENCES options(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  value VARCHAR(20) NOT NULL CHECK (value IN ('yes', 'no', 'abstain')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_option_member_vote UNIQUE (option_id, member_id)
);

CREATE TABLE IF NOT EXISTS expenses (
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

CREATE TABLE IF NOT EXISTS splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  weight NUMERIC(10, 2) NULL,
  exact_amount NUMERIC(12, 2) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_expense_member_split UNIQUE (expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind VARCHAR(50) NOT NULL CHECK (kind IN ('flight', 'stay', 'activity', 'contact', 'other', 'itinerary')),
  doc_type VARCHAR(50) NULL, -- 'pdf', 'image'
  source_file_url TEXT NULL,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NULL,
  type VARCHAR(50) NOT NULL, -- 'flight', 'stay', 'activity', 'other'
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255) NULL,
  source_vault_item_id UUID NULL REFERENCES vault_items(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'personal' CHECK (category IN ('personal', 'shared')),
  assigned_to UUID NULL REFERENCES members(id) ON DELETE SET NULL,
  per_person BOOLEAN NOT NULL DEFAULT false,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Proactive concierge tracking columns
ALTER TABLE trips ADD COLUMN IF NOT EXISTS last_concierge_run_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS concierge_cooldown_until TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS last_audit_hash VARCHAR(64) NULL;

-- Invite token expiry (30-day default; NULL = no expiry for legacy rows)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMP WITH TIME ZONE NULL;

-- Itinerary items: structured time columns (preferred over legacy date/time)
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS ends_at   TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS tz        VARCHAR(64) NULL; -- IANA tz, e.g. 'Asia/Kolkata'

-- Voucher file bytes stored in-DB (Vercel serverless FS is read-only; no external blob store).
-- Served through the auth-gated, signed proxy route /api/trip/[tripId]/uploads/[filename].
CREATE TABLE IF NOT EXISTS vault_files (
  filename   VARCHAR(255) PRIMARY KEY,
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  mime_type  VARCHAR(100) NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Affiliate / monetization tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS partners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 VARCHAR(100) UNIQUE NOT NULL,         -- slug, e.g. 'travelpayouts'
  name                VARCHAR(255) NOT NULL,
  category            VARCHAR(50)  NOT NULL,                -- hotel|activity|insurance|esim|forex|transport|gear|photobook
  network             VARCHAR(100) NOT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')),
  affiliate_id        VARCHAR(255) NOT NULL DEFAULT '',
  secret_ref          VARCHAR(255) NULL,                    -- env-var name or vault key for postback secret
  link_template       TEXT         NOT NULL,                -- URL with {id} and {sub} placeholders
  sub_param           VARCHAR(100) NOT NULL,                -- query param the partner uses for sub-id
  commission_estimate NUMERIC(5,2) NOT NULL DEFAULT 0,
  priority            INTEGER      NOT NULL DEFAULT 0,
  surface_triggers    TEXT[]       NOT NULL DEFAULT '{}',   -- which trigger events surface this partner
  allowed_domains     TEXT[]       NOT NULL DEFAULT '{}',   -- redirect allowlist for open-redirect guard
  updated_by          UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category            VARCHAR(50)  NOT NULL,
  partner             VARCHAR(255) NOT NULL,
  title               TEXT         NOT NULL,
  price               NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency            VARCHAR(10)  NOT NULL DEFAULT 'INR',
  deep_link           TEXT         NOT NULL,                -- unresolved template with {sub}
  commission_estimate NUMERIC(10,2) NOT NULL DEFAULT 0,
  surfaced_by         VARCHAR(100) NULL,                    -- trigger event that created this offer
  status              VARCHAR(20)  NOT NULL DEFAULT 'shown' CHECK (status IN ('shown','clicked','converted','dismissed')),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offer_clicks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id   UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  member_id  UUID NULL REFERENCES members(id) ON DELETE SET NULL,
  sub_id     VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID NULL REFERENCES offers(id) ON DELETE SET NULL,
  sub_id      VARCHAR(500) NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sub_id)                                          -- idempotency: one conversion per sub_id
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50)  NULL,
  target_id   UUID         NULL,
  changes     JSONB        NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add allowed_domains to partners if upgrading an existing DB
ALTER TABLE partners ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] NOT NULL DEFAULT '{}';

-- Add indexes for performance on foreign keys
CREATE INDEX IF NOT EXISTS idx_members_trip_id ON members(trip_id);
CREATE INDEX IF NOT EXISTS idx_messages_trip_id ON messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_decisions_trip_id ON decisions(trip_id);
CREATE INDEX IF NOT EXISTS idx_options_decision_id ON options(decision_id);
CREATE INDEX IF NOT EXISTS idx_votes_decision_id ON votes(decision_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_splits_expense_id ON splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_trip_id ON vault_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_id ON itinerary_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_trip_id ON checklist_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_trip_id ON vault_files(trip_id);


-- Scrapbook photos: trip memory photos uploaded by members
CREATE TABLE IF NOT EXISTS scrapbook_photos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploader_member_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  filename            VARCHAR(255) NOT NULL REFERENCES vault_files(filename) ON DELETE CASCADE,
  caption             TEXT,
  taken_at            DATE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scrapbook_photos_trip_id ON scrapbook_photos(trip_id);
