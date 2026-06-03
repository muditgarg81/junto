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
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  
  console.log('--- ALL MEMBERS FOR NEW YEARS TRIP ---');
  const members = await client.query("SELECT id, trip_id, name, status, roles, auth_id, user_id FROM members WHERE trip_id = '7d899868-6a61-41d6-b70d-1d02394c9552'");
  console.table(members.rows);

  console.log('--- ALL USERS IN DB ---');
  const users = await client.query("SELECT id, auth_id, name, email FROM users");
  console.table(users.rows);

  await client.end();
}

run().catch(console.error);
