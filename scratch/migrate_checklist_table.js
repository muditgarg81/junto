const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env.local for database credentials
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
  console.log('Connected to database, adding source and imported_from_trip_id columns to checklist_items...');
  
  await client.query(`
    ALTER TABLE checklist_items 
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_chat', 'imported'));
  `);
  
  await client.query(`
    ALTER TABLE checklist_items 
    ADD COLUMN IF NOT EXISTS imported_from_trip_id UUID NULL REFERENCES trips(id) ON DELETE SET NULL;
  `);

  console.log('Migration completed successfully.');
  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
