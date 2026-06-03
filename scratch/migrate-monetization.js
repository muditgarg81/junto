const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn('Error reading .env.local:', e.message);
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is missing. Please create .env.local with DATABASE_URL defined.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to database. Executing monetization migrations...');

  const sql = `
    CREATE TABLE IF NOT EXISTS offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      category VARCHAR(50) NOT NULL CHECK (category IN ('hotel', 'activity', 'insurance', 'esim', 'forex', 'transport')),
      partner VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      price NUMERIC(12, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      deep_link TEXT NOT NULL,
      commission_estimate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      surfaced_by VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'shown' CHECK (status IN ('shown', 'clicked', 'converted', 'dismissed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS offer_clicks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
      member_id UUID REFERENCES members(id) ON DELETE SET NULL,
      sub_id VARCHAR(255) NOT NULL,
      clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
      sub_id VARCHAR(255) NOT NULL,
      gross_amount NUMERIC(12, 2) NOT NULL,
      commission NUMERIC(12, 2) NOT NULL,
      confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trip_upgrades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      tier VARCHAR(50) NOT NULL DEFAULT 'boost',
      paid_by UUID REFERENCES members(id) ON DELETE SET NULL,
      provider VARCHAR(50) NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
      provider_ref VARCHAR(255) NULL,
      amount NUMERIC(12, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_offers_trip_id ON offers(trip_id);
    CREATE INDEX IF NOT EXISTS idx_offer_clicks_offer_id ON offer_clicks(offer_id);
    CREATE INDEX IF NOT EXISTS idx_conversions_offer_id ON conversions(offer_id);
    CREATE INDEX IF NOT EXISTS idx_trip_upgrades_trip_id ON trip_upgrades(trip_id);
  `;

  await client.query(sql);
  console.log('Monetization migration applied successfully.');

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
