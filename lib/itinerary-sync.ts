'use strict';

import { query } from './db';
import { complete } from './llm';
import { getTripPricingContext } from './pricing/context';
import { localToInstantISO } from './airport-tz';
import crypto from 'crypto';

interface ItineraryOp {
  action: 'insert' | 'update' | 'delete' | 'none';
  existingItemId?: string | null;
  item?: {
    title: string;
    type: 'flight' | 'stay' | 'activity' | 'transport' | 'other';
    date: string; // YYYY-MM-DD
    time?: string | null; // HH:MM:SS or HH:MM
    location?: string | null;
  } | null;
}

// Maps destinations to basic timezones
const DEST_TZ_MAP: Record<string, string> = {
  goa: 'Asia/Kolkata', jodhpur: 'Asia/Kolkata', jaipur: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', bangalore: 'Asia/Kolkata',
  paris: 'Europe/Paris', london: 'Europe/London', dubai: 'Asia/Dubai',
  singapore: 'Asia/Singapore', bangkok: 'Asia/Bangkok', bali: 'Asia/Makassar',
  tokyo: 'Asia/Tokyo', newyork: 'America/New_York'
};

function getDestinationTz(destination: string): string {
  const norm = destination.toLowerCase().replace(/\s+/g, '');
  for (const [key, tz] of Object.entries(DEST_TZ_MAP)) {
    if (norm.includes(key)) return tz;
  }
  return 'Asia/Kolkata'; // Default fallback
}

/**
 * Parses a locked decision and automatically adds, updates, or removes itinerary items.
 */
export async function syncItineraryFromDecision(
  tripId: string,
  decisionId: string,
  optionId: string
): Promise<void> {
  try {
    console.log(`[ItinerarySync] Syncing for trip ${tripId}, decision ${decisionId}, option ${optionId}`);

    // 1. Fetch trip pricing context (dates and destination)
    const pricingCtx = await getTripPricingContext(tripId);

    // 2. Fetch the locked decision + resolved option details
    const decisionRes = await query(
      `SELECT d.type as decision_type, d.title as decision_title, o.label as option_label, o.payload as option_payload
       FROM decisions d
       JOIN options o ON o.decision_id = d.id
       WHERE d.id = $1 AND o.id = $2`,
      [decisionId, optionId]
    );

    if (decisionRes.rows.length === 0) {
      console.warn(`[ItinerarySync] Decision/Option not found for sync: dec=${decisionId}, opt=${optionId}`);
      return;
    }

    const { decision_type, decision_title, option_label, option_payload } = decisionRes.rows[0];

    // 3. Fetch existing itinerary items
    const itineraryRes = await query(
      'SELECT id, type, date::text, time::text, title, location FROM itinerary_items WHERE trip_id = $1 ORDER BY date ASC, time ASC',
      [tripId]
    );
    const existingItems = itineraryRes.rows;

    // 4. Construct prompt for LLM
    const userPrompt = `
TRIP CONTEXT:
Destination: ${pricingCtx.destination}
Trip Start Date: ${pricingCtx.startDate || 'TBD'}
Trip End Date: ${pricingCtx.endDate || 'TBD'}

LOCKED DECISION DETAILS:
Decision Type: ${decision_type}
Decision Title: ${decision_title}
Selected Option Label: ${option_label}
Option Payload: ${JSON.stringify(option_payload || {})}

EXISTING ITINERARY ITEMS:
${JSON.stringify(existingItems, null, 2)}
`;

    const systemPrompt = `You are a group travel assistant coordinating the shared trip itinerary.
A decision has just been locked by the group. You need to determine if this decision affects the itinerary, and if so, how.

You can perform one of the following operations:
1. "none": If the decision is not related to the itinerary (e.g., general budget decisions, rules, or if it doesn't represent an event/accommodation/flight/activity/transport).
2. "insert": If the decision represents a new item to add to the itinerary.
3. "update": If the decision updates or changes an existing itinerary item (e.g., changing dates, times, or details of an existing activity/stay/flight).
4. "delete": If the decision represents removing an item from the itinerary.

CRITICAL RULES:
- If a decision title is "Amend Osian Desert Experience Date in Itinerary" and the resolved option is "Update Osian Experience to June 25 and remove June 26 Osian activities", you must output two operations:
  a. An "update" operation modifying the existing "Osian Desert Experience" (or similar item) to June 25.
  b. A "delete" operation for the June 26 activity if it exists in the itinerary.
- Ensure that for "insert" and "update", the "date" is in "YYYY-MM-DD" format and falls within the Trip Start/End Date range.
- For "update" or "delete", you MUST specify the correct "existingItemId" of the item being modified/removed from the list of existing itinerary items.
- If no changes should be made to the itinerary, return an empty operations list.

Return a JSON object matching the schema.`;

    const jsonSchema = {
      type: 'OBJECT',
      properties: {
        operations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['insert', 'update', 'delete', 'none'] },
              existingItemId: { type: 'STRING', nullable: true },
              item: {
                type: 'OBJECT',
                nullable: true,
                properties: {
                  title: { type: 'STRING' },
                  type: { type: 'STRING', enum: ['flight', 'stay', 'activity', 'transport', 'other'] },
                  date: { type: 'STRING' },
                  time: { type: 'STRING', nullable: true },
                  location: { type: 'STRING', nullable: true }
                },
                required: ['title', 'type', 'date']
              }
            },
            required: ['action']
          }
        }
      },
      required: ['operations']
    };

    const rawResult = await complete(userPrompt, systemPrompt, jsonSchema);
    const result = JSON.parse(rawResult);
    const operations: ItineraryOp[] = result.operations || [];
    console.log(`[ItinerarySync] Generated operations:`, JSON.stringify(operations, null, 2));

    const tz = getDestinationTz(pricingCtx.destination);

    for (const op of operations) {
      if (op.action === 'none') continue;

      if (op.action === 'delete' && op.existingItemId) {
        console.log(`[ItinerarySync] Deleting itinerary item: ${op.existingItemId}`);
        await query(
          'DELETE FROM itinerary_items WHERE id = $1 AND trip_id = $2',
          [op.existingItemId, tripId]
        );
      } else if (op.action === 'insert' && op.item) {
        console.log(`[ItinerarySync] Inserting itinerary item: ${op.item.title}`);
        const startsAt = localToInstantISO(op.item.date, op.item.time, tz);
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, starts_at, tz)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            crypto.randomUUID(),
            tripId,
            op.item.date,
            op.item.time || null,
            op.item.type,
            op.item.title,
            op.item.location || null,
            startsAt,
            tz
          ]
        );
      } else if (op.action === 'update' && op.existingItemId && op.item) {
        console.log(`[ItinerarySync] Updating itinerary item: ${op.existingItemId} (${op.item.title})`);
        const startsAt = localToInstantISO(op.item.date, op.item.time, tz);
        await query(
          `UPDATE itinerary_items
           SET date = $3,
               time = $4,
               type = $5,
               title = $6,
               location = $7,
               starts_at = $8,
               tz = $9
           WHERE id = $1 AND trip_id = $2`,
          [
            op.existingItemId,
            tripId,
            op.item.date,
            op.item.time || null,
            op.item.type,
            op.item.title,
            op.item.location || null,
            startsAt,
            tz
          ]
        );
      }
    }

    console.log(`[ItinerarySync] Finished sync for trip ${tripId}`);
  } catch (err) {
    console.error('[ItinerarySync] Failed to sync itinerary from decision:', err);
  }
}
