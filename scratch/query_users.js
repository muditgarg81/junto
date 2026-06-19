const fs = require('fs');
const path = require('path');
const pg = require('pg');

// Manually parse .env.local
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
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Querying users schema...');
  const columnsRes = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
  `);
  console.log('Columns:', columnsRes.rows);

  console.log('\nQuerying all users...');
  const usersRes = await pool.query('SELECT id, email, name, auth_id FROM users');
  console.log('Users:', usersRes.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
