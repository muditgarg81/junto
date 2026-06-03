const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const matches = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  const connectionString = matches ? matches[1] : null;
  if (!connectionString) {
    console.error("Could not find DATABASE_URL in .env.local");
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    console.log("Running migration on members table...");
    
    // 1. Add user_id column if it does not exist
    await client.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    `);
    console.log("Added user_id column to members table (if not exists).");

    // 2. Drop NOT NULL constraint on name column
    await client.query(`
      ALTER TABLE members ALTER COLUMN name DROP NOT NULL;
    `);
    console.log("Made name column on members table nullable.");

    // 3. Link existing members to users via auth_id match
    await client.query(`
      UPDATE members m
      SET user_id = u.id
      FROM users u
      WHERE m.auth_id = u.auth_id AND m.user_id IS NULL;
    `);
    console.log("Linked existing members to users via auth_id.");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
