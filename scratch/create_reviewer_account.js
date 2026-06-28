const fs = require('fs');
const pg = require('pg');
const bcrypt = require('bcryptjs');

const envPath = 'C:/claude/JUNTOFUN/.env.local';
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
  const testEmail = 'googleplaytester@juntofun.com';
  const testPassword = 'JuntoTest123!';
  const displayName = 'Google Play Tester';
  const authId = 'email-googleplaytester';

  console.log(`Checking if ${testEmail} exists...`);
  const checkRes = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);

  if (checkRes.rows.length > 0) {
    console.log('Account already exists. Updating password to ensure it is correct...');
    const hash = await bcrypt.hash(testPassword, 10);
    await pool.query(
      'UPDATE users SET name = $1, password_hash = $2, auth_id = $3 WHERE email = $4',
      [displayName, hash, authId, testEmail]
    );
    console.log('Password updated successfully.');
  } else {
    console.log('Creating new reviewer account...');
    const hash = await bcrypt.hash(testPassword, 10);
    const insertRes = await pool.query(
      `INSERT INTO users (id, auth_id, email, name, password_hash, home_currency) 
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'INR') RETURNING *`,
      [authId, testEmail, displayName, hash]
    );
    console.log('Reviewer account created successfully:', insertRes.rows[0]);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
