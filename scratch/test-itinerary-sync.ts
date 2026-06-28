import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const tripId = 'e847155d-2d7a-49ee-8c44-826150ebae84'; // Jodhpur trip
  const decisionId = crypto.randomUUID();
  const optionId = crypto.randomUUID();

  console.log('Inserting test decision and option...');
  await client.query(`
    INSERT INTO decisions (id, trip_id, type, title, status, resolved_option_id)
    VALUES ($1, $2, 'logistics', 'Amend Osian Desert Experience Date in Itinerary', 'locked', null)
  `, [decisionId, tripId]);

  await client.query(`
    INSERT INTO options (id, decision_id, label, payload)
    VALUES ($1, $2, 'Update Osian Experience to June 25 and remove June 26 Osian activities', '{}'::jsonb)
  `, [optionId, decisionId]);

  await client.query(`
    UPDATE decisions SET resolved_option_id = $1 WHERE id = $2
  `, [optionId, decisionId]);

  // Insert mock itinerary items first
  const existingItemId1 = crypto.randomUUID();
  const existingItemId2 = crypto.randomUUID();
  
  console.log('Inserting mock itinerary items to test re-scheduling and deletion...');
  await client.query(`
    INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location)
    VALUES 
      ($1, $2, '2026-06-26', '10:00:00', 'activity', 'Osian Desert Experience', 'Osian'),
      ($3, $2, '2026-06-26', '16:00:00', 'activity', 'Sunset Osian Camel Safari', 'Osian')
  `, [existingItemId1, tripId, existingItemId2]);

  console.log('Running syncItineraryFromDecision...');
  const { syncItineraryFromDecision } = await import('../lib/itinerary-sync');
  await syncItineraryFromDecision(tripId, decisionId, optionId);

  console.log('Querying updated itinerary...');
  const res = await client.query('SELECT id, date::text, time::text, title FROM itinerary_items WHERE trip_id = $1', [tripId]);
  console.log('Itinerary Items after sync:');
  console.log(JSON.stringify(res.rows, null, 2));

  // Clean up test data
  console.log('Cleaning up test data...');
  await client.query('DELETE FROM decisions WHERE id = $1', [decisionId]);
  await client.query('DELETE FROM options WHERE id = $1', [optionId]);
  await client.query('DELETE FROM itinerary_items WHERE id IN ($1, $2) OR date = $3', [existingItemId1, existingItemId2, '2026-06-25']);

  await client.end();
}

main().catch(async err => {
  console.error('Test failed:', err);
  await client.end();
  process.exit(1);
});
