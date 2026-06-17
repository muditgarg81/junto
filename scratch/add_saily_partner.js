'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
        if (key && !process.env[key]) process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.warn('Error reading .env.local:', e.message);
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(
    `INSERT INTO partners (key, name, category, network, status, affiliate_id, secret_ref, link_template, sub_param, commission_estimate, priority, surface_triggers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (key) DO UPDATE
     SET name = EXCLUDED.name,
         network = EXCLUDED.network,
         status = EXCLUDED.status,
         affiliate_id = EXCLUDED.affiliate_id,
         link_template = EXCLUDED.link_template,
         sub_param = EXCLUDED.sub_param,
         commission_estimate = EXCLUDED.commission_estimate,
         priority = EXCLUDED.priority,
         surface_triggers = EXCLUDED.surface_triggers`,
    [
      'saily',
      'Saily eSIM',
      'esim',
      'Travelpayouts',
      'active',
      '8014',
      null,
      'https://saily.tpk.lu/EnM76fHG',
      'aff_sub',
      15.0,
      2,
      ['dates_locked', 'flight_voucher_ingested']
    ]
  );

  console.log('Saily eSIM partner added.');
  await client.end();
}

run().catch(err => { console.error(err); process.exit(1); });
