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
  
  console.log('--- ALL TRIPS IN DB ---');
  const trips = await client.query('SELECT * FROM trips');
  console.table(trips.rows.map(t => ({ id: t.id, name: t.name, status: t.status })));

  console.log('--- ALL MESSAGES IN DB ---');
  const messages = await client.query('SELECT m.id, m.trip_id, t.name as trip_name, m.body, m.is_ai FROM messages m JOIN trips t ON m.trip_id = t.id ORDER BY m.created_at DESC LIMIT 10');
  console.table(messages.rows.map(m => ({
    id: m.id,
    trip_id: m.trip_id,
    trip_name: m.trip_name,
    body: m.body,
    is_ai: m.is_ai
  })));

  await client.end();
}

run().catch(console.error);
