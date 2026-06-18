const pg = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let connectionString = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connectionString = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

if (!connectionString) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT * FROM trips LIMIT 1');
  console.log('Database query success! Found trips:', res.rows.length);
  await pool.end();
}

main().catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
