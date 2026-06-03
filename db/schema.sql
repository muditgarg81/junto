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
  kind VARCHAR(50) NOT NULL CHECK (kind IN ('flight', 'stay', 'activity', 'contact', 'other')),
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
