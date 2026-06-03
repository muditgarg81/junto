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
    const res = await client.query(`
      SELECT id, name, status, roles, auth_id, upi_id FROM members LIMIT 10
    `);
    console.log("Members in database:");
    res.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
