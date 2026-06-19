const fs = require('fs');
const path = require('path');
const pg = require('pg');

const envPath = path.join(__dirname, '../.env.local');
let databaseUrl = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('DATABASE_URL=')) {
      databaseUrl = line.split('DATABASE_URL=')[1].trim().replace(/^['"]|['"]$/g, '');
      break;
    }
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Updating existing AirHelp offer titles and prices in the database...');
  const res = await pool.query(`
    UPDATE offers 
    SET title = 'AirHelp - Delayed Flight Compensation Claim (Up to ₹55,000)', 
        price = 0 
    WHERE LOWER(partner) = 'airhelp'
  `);
  console.log('Update result:', res.rowCount, 'rows updated.');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
