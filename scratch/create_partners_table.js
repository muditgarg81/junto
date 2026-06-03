'use strict';

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
    console.error('DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to database. Executing partners migrations...');

  const sql = `
    CREATE TABLE IF NOT EXISTS partners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      network VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      affiliate_id VARCHAR(255) NOT NULL,
      secret_ref VARCHAR(255) NULL,
      link_template TEXT NOT NULL,
      sub_param VARCHAR(100) NOT NULL,
      commission_estimate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
      priority INTEGER NOT NULL DEFAULT 0,
      surface_triggers TEXT[] NOT NULL DEFAULT '{}',
      updated_by UUID NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NULL, -- Can be NULL for system actions or migrations
      action VARCHAR(255) NOT NULL,
      target_type VARCHAR(100) NOT NULL,
      target_id UUID NULL,
      changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_partners_category ON partners(category);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  `;

  await client.query(sql);
  console.log('Tables created. Seeding partners...');

  const defaultPartners = [
    {
      key: 'booking',
      name: 'Booking.com',
      category: 'hotel',
      network: 'Travelpayouts',
      status: 'active',
      affiliate_id: 'booking_aid_placeholder',
      secret_ref: 'booking_secret_ref',
      link_template: 'https://booking.com/affiliate/search?dest={id}',
      sub_param: 'sub_id',
      commission_estimate: 8.0,
      priority: 1,
      surface_triggers: ['hotel_decision_opened']
    },
    {
      key: 'agoda',
      name: 'Agoda',
      category: 'hotel',
      network: 'Travelpayouts',
      status: 'active',
      affiliate_id: 'agoda_aid_placeholder',
      secret_ref: 'agoda_secret_ref',
      link_template: 'https://agoda.com/affiliate/search?q={id}',
      sub_param: 'sub_id',
      commission_estimate: 8.0,
      priority: 2,
      surface_triggers: ['hotel_decision_opened']
    },
    {
      key: 'care_insurance',
      name: 'Care Insurance',
      category: 'insurance',
      network: 'Direct',
      status: 'active',
      affiliate_id: 'care_junto_partner',
      secret_ref: 'care_secret_ref',
      link_template: 'https://careinsurance.com/partner/junto-group-travel',
      sub_param: 'aff_sub',
      commission_estimate: 25.0,
      priority: 1,
      surface_triggers: ['dates_locked']
    },
    {
      key: 'airalo',
      name: 'Airalo eSIM',
      category: 'esim',
      network: 'Impact',
      status: 'active',
      affiliate_id: 'airalo_junto',
      secret_ref: 'airalo_secret_ref',
      link_template: 'https://airalo.com/affiliate/store?country={id}',
      sub_param: 'opaque_id',
      commission_estimate: 30.0,
      priority: 1,
      surface_triggers: ['flight_voucher_ingested']
    },
    {
      key: 'bookmyforex',
      name: 'BookMyForex',
      category: 'forex',
      network: 'Direct',
      status: 'active',
      affiliate_id: 'bmf_junto',
      secret_ref: 'bmf_secret_ref',
      link_template: 'https://bookmyforex.com/partner/junto',
      sub_param: 'junto_id',
      commission_estimate: 30.0,
      priority: 1,
      surface_triggers: ['flight_voucher_ingested']
    },
    {
      key: 'viator',
      name: 'Viator',
      category: 'activity',
      network: 'Travelpayouts',
      status: 'active',
      affiliate_id: 'viator_junto',
      secret_ref: 'viator_secret_ref',
      link_template: 'https://viator.com/partner/search?q={id}',
      sub_param: 'sub_ref',
      commission_estimate: 15.0,
      priority: 1,
      surface_triggers: ['activity_interest']
    },
    {
      key: 'mmt_transfers',
      name: 'MakeMyTrip Transfers',
      category: 'transport',
      network: 'Direct',
      status: 'active',
      affiliate_id: 'mmt_junto',
      secret_ref: 'mmt_secret_ref',
      link_template: 'https://makemytrip.com/cabs/affiliate',
      sub_param: 'subId',
      commission_estimate: 10.0,
      priority: 1,
      surface_triggers: ['transport_expense']
    }
  ];

  for (const partner of defaultPartners) {
    await client.query(
      `INSERT INTO partners (key, name, category, network, status, affiliate_id, secret_ref, link_template, sub_param, commission_estimate, priority, surface_triggers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (key) DO UPDATE
       SET name = EXCLUDED.name,
           category = EXCLUDED.category,
           network = EXCLUDED.network,
           status = EXCLUDED.status,
           affiliate_id = EXCLUDED.affiliate_id,
           secret_ref = EXCLUDED.secret_ref,
           link_template = EXCLUDED.link_template,
           sub_param = EXCLUDED.sub_param,
           commission_estimate = EXCLUDED.commission_estimate,
           priority = EXCLUDED.priority,
           surface_triggers = EXCLUDED.surface_triggers`,
      [
        partner.key,
        partner.name,
        partner.category,
        partner.network,
        partner.status,
        partner.affiliate_id,
        partner.secret_ref,
        partner.link_template,
        partner.sub_param,
        partner.commission_estimate,
        partner.priority,
        partner.surface_triggers
      ]
    );
    console.log(`Seeded partner: ${partner.name}`);
  }

  await client.end();
  console.log('Partners migration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
