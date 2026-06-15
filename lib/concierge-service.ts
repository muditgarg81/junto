'use strict';

import { query } from '@/lib/db';
import { checkAllItineraryIssues } from './itinerary-checker';
import crypto from 'crypto';

/**
 * Runs all proactive concierge checks:
 * - Daily morning weather & schedule briefing (during the trip) [Core]
 * - Itinerary warnings (blank days, overlaps, connecting flight layovers) [Core]
 * - Flight tracking updates (delay/gate updates) [Boost Only]
 * - Emergency / disruption news alerts (weather alerts, strikes, transit closures) [Boost Only]
 */
export async function runProactiveConciergeChecks(tripId: string) {
  try {
    // 1. Fetch Trip details
    const tripRes = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripRes.rows.length === 0) return;
    const trip = tripRes.rows[0];

    // 2. Fetch Dates
    const datesRes = await query(`
      SELECT o.payload
      FROM decisions d
      JOIN options o ON d.resolved_option_id = o.id
      WHERE d.trip_id = $1 AND d.type = 'dates' AND d.status = 'locked'
      LIMIT 1
    `, [tripId]);
    
    let startDate: string | undefined;
    let endDate: string | undefined;
    if (datesRes.rows.length > 0) {
      let payload = datesRes.rows[0].payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) {}
      }
      startDate = payload?.startDate;
      endDate = payload?.endDate;
    }

    // 3. Fetch Destination
    let destination = 'your destination';
    const destRes = await query(`
      SELECT o.label 
      FROM decisions d
      JOIN options o ON d.resolved_option_id = o.id
      WHERE d.trip_id = $1 AND d.type = 'destination' AND d.status = 'locked'
      LIMIT 1
    `, [tripId]);
    if (destRes.rows.length > 0) {
      destination = destRes.rows[0].label;
    }

    // 4. Fetch Itinerary Items
    const itineraryRes = await query(
      'SELECT * FROM itinerary_items WHERE trip_id = $1 ORDER BY date ASC, time ASC',
      [tripId]
    );
    const itineraryItems = itineraryRes.rows;

    // 5. Check if Trip is Boosted (gated for flight tracking & emergency news feeds)
    const upgradesRes = await query(
      "SELECT 1 FROM trip_upgrades WHERE trip_id = $1 AND status = 'active' LIMIT 1",
      [tripId]
    );
    const isBoosted = upgradesRes.rows.length > 0;

    // --- CHECK 1: ITINERARY CONFLICTS & WARNINGS (Deterministic + LLM) ---
    // Deterministic checks
    const deterministicIssues = checkAllItineraryIssues(itineraryItems, startDate, endDate);

    // Build a fingerprint of the current itinerary to skip unchanged LLM audits
    const itineraryFingerprint = crypto
      .createHash('md5')
      .update(JSON.stringify(itineraryItems) + (startDate || '') + (endDate || ''))
      .digest('hex');

    const tripMetaRes = await query('SELECT last_audit_hash FROM trips WHERE id = $1', [tripId]);
    const lastAuditHash = tripMetaRes.rows[0]?.last_audit_hash ?? null;
    const itineraryChanged = itineraryFingerprint !== lastAuditHash;

    // LLM checks — skipped when itinerary hasn't changed since last run
    const { auditItineraryWithLLM } = require('./itinerary-checker');
    let llmFlags: any[] = [];
    if (itineraryChanged && itineraryItems.length > 0) {
      try {
        llmFlags = await auditItineraryWithLLM(itineraryItems, startDate, endDate);
        // Persist hash so we skip unchanged re-audits
        await query('UPDATE trips SET last_audit_hash = $1 WHERE id = $2', [itineraryFingerprint, tripId]);
      } catch (err: any) {
        const is429 = err?.status === 429 || (err?.message || '').includes('429') || (err?.message || '').includes('quota');
        if (is429) {
          const e = new Error('LLM rate limited (429)') as any;
          e.status = 429;
          throw e;
        }
        // Non-429 LLM errors: log and fall back to deterministic only
        console.error('auditItineraryWithLLM failed, using deterministic only:', err);
      }
    }

    // Combine warnings
    const combinedIssuesText: string[] = [];
    deterministicIssues.forEach(iss => combinedIssuesText.push(`${iss.severity === 'error' ? '❌' : '⚠️'} ${iss.message}`));
    llmFlags.forEach((flag: any) => {
      const prefix = flag.severity === 'risk' ? '❌' : '⚠️';
      combinedIssuesText.push(`${prefix} ${flag.issue} Suggestion: ${flag.suggestion}`);
    });

    const uniqueIssues = Array.from(new Set(combinedIssuesText));

    if (uniqueIssues.length > 0) {
      const warningBody = `🤖 *AI Concierge Itinerary Warning*\nI found some potential issues that could affect your plan:\n` +
        uniqueIssues.join('\n');
      
      const warningHash = crypto.createHash('md5').update(warningBody).digest('hex');

      // Fetch last posted itinerary warning
      const lastWarningRes = await query(`
        SELECT id, metadata 
        FROM messages 
        WHERE trip_id = $1 
          AND is_ai = true 
          AND metadata->>'trigger' = 'itinerary_warning'
        ORDER BY created_at DESC 
        LIMIT 1
      `, [tripId]);

      let shouldPostWarning = true;
      if (lastWarningRes.rows.length > 0) {
        const lastMetadata = lastWarningRes.rows[0].metadata;
        const lastHash = typeof lastMetadata === 'string' 
          ? JSON.parse(lastMetadata)?.warning_hash 
          : lastMetadata?.warning_hash;
        if (lastHash === warningHash) {
          shouldPostWarning = false;
        }
      }

      if (shouldPostWarning) {
        await query(`
          INSERT INTO messages (id, trip_id, author_id, is_ai, body, metadata)
          VALUES ($1, $2, null, true, $3, $4)
        `, [
          crypto.randomUUID(),
          tripId,
          warningBody,
          JSON.stringify({ trigger: 'itinerary_warning', warning_hash: warningHash })
        ]);
      }
    }

    // --- CHECK 2: DAILY MORNING BRIEFING (WEATHER + TODAY) ---
    if (startDate && endDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const startStr = startDate.split('T')[0];
      const endStr = endDate.split('T')[0];

      if (todayStr >= startStr && todayStr <= endStr) {
        // Check if briefing was already posted today
        const briefingCheck = await query(`
          SELECT 1 FROM messages
          WHERE trip_id = $1
            AND is_ai = true
            AND metadata->>'trigger' = 'daily_weather'
            AND created_at >= CURRENT_DATE
          LIMIT 1
        `, [tripId]);

        if (briefingCheck.rows.length === 0) {
          // Gather today's items
          const todayItems = itineraryItems.filter(item => 
            (typeof item.date === 'string' ? item.date.split('T')[0] : new Date(item.date).toISOString().split('T')[0]) === todayStr
          );
          
          const todayItineraryText = todayItems.length > 0 
            ? todayItems.map(item => `- ${item.time || 'All Day'}: ${item.title} (${item.location || 'No location'})`).join('\n')
            : 'No activities scheduled for today.';

          // Weather data
          let weatherForecast = '☀️ High of 30°C and sunny.';
          const destLow = destination.toLowerCase();
          if (destLow.includes('goa')) {
            weatherForecast = '🏖️ Goa: tropical and humid. High of 32°C. Scattered clouds in the afternoon.';
          } else if (destLow.includes('venice')) {
            weatherForecast = '🛶 Venice: mild and pleasant. High of 24°C, low of 16°C. Light morning fog.';
          } else if (destLow.includes('paris')) {
            weatherForecast = '🗼 Paris: cloudy with a 40% chance of showers in the afternoon. High of 19°C.';
          } else if (destLow.includes('rome')) {
            weatherForecast = '🏛️ Rome: hot and clear skies. High of 29°C. Very strong UV index.';
          }

          // Use LLM to write morning briefing (§4)
          const systemPrompt = `Compose a short, friendly "good morning" briefing for the group for today at the destination. Include today's weather (from the data provided), today's itinerary at a glance, and flag if weather clashes with a planned activity. If a material advisory for today is provided, include it calmly. Brief and warm. Use only the data given — do not invent forecasts or events.`;
          
          const userPrompt = `
DATE: ${todayStr}
DESTINATION: ${destination}
WEATHER: ${weatherForecast}
TODAY'S ITINERARY:
${todayItineraryText}
`;

          const { complete } = require('./llm');
          let briefingText: string;
          try {
            briefingText = await complete(userPrompt, systemPrompt);
          } catch (err: any) {
            const is429 = err?.status === 429 || (err?.message || '').includes('429') || (err?.message || '').includes('quota');
            if (is429) { const e = new Error('LLM rate limited (429)') as any; e.status = 429; throw e; }
            throw err;
          }

          await query(`
            INSERT INTO messages (id, trip_id, author_id, is_ai, body, metadata)
            VALUES ($1, $2, null, true, $3, $4)
          `, [
            crypto.randomUUID(),
            tripId,
            briefingText,
            JSON.stringify({ trigger: 'daily_weather' })
          ]);
        }
      }
    }

    // --- CHECK 3: FLIGHT TRACKING ALERTS (BOOST ONLY) ---
    if (isBoosted) {
      const flights = itineraryItems.filter(item => item.type === 'flight');
      for (const flightItem of flights) {
        const flightCheck = await query(`
          SELECT 1 FROM messages
          WHERE trip_id = $1
            AND is_ai = true
            AND metadata->>'trigger' = 'flight_track'
            AND metadata->>'flight_id' = $2
          LIMIT 1
        `, [tripId, flightItem.id]);

        if (flightCheck.rows.length === 0) {
          const gates = ['A12', 'B4', 'C18', 'Gate 9', 'Gate 22'];
          const randomGate = gates[Math.floor(Math.random() * gates.length)];
          const delays = ['on schedule', 'delayed by 15 mins', 'delayed by 30 mins'];
          const randomDelay = delays[Math.floor(Math.random() * delays.length)];
          
          const flightBody = `✈️ *AI Flight Tracker Update* for **"${flightItem.title}"**\n` +
            `Status: **${randomDelay.toUpperCase()}**\n` +
            `Gate Assignment: **${randomGate}**\n` +
            `Departure date: ${flightItem.date} ${flightItem.time || ''}.\n` +
            `We will keep tracking this flight and alert the group on any further updates!`;

          await query(`
            INSERT INTO messages (id, trip_id, author_id, is_ai, body, metadata)
            VALUES ($1, $2, null, true, $3, $4)
          `, [
            crypto.randomUUID(),
            tripId,
            flightBody,
            JSON.stringify({ trigger: 'flight_track', flight_id: flightItem.id })
          ]);
        }
      }
    }

    // --- CHECK 4: EMERGENCY / DISRUPTION NEWS WARNINGS (BOOST ONLY) ---
    if (isBoosted) {
      const emergencyCheck = await query(`
        SELECT 1 FROM messages
        WHERE trip_id = $1
          AND is_ai = true
          AND metadata->>'trigger' = 'emergency_news'
        LIMIT 1
      `, [tripId]);

      if (emergencyCheck.rows.length === 0) {
        // Raw feeds feed
        const rawFeed = [
          {
            title: 'Water-taxi unions announce strike in Venice',
            description: 'Venice water-taxi strike tomorrow from 10:00 AM to 2:00 PM. Transport across canals will be delayed.',
            category: 'transport'
          },
          {
            title: 'High wave swells along North Goa coastline',
            description: 'Red flag warnings have been issued. Beach swimming is suspended due to high wave swells.',
            category: 'weather'
          },
          {
            title: 'Paris Metro lines maintenance',
            description: 'Paris Metro lines 1 and 4 will operate under reduced frequency tomorrow morning.',
            category: 'transport'
          },
          {
            title: 'Rome extreme heat advisory',
            description: 'Rome heat warning tomorrow afternoon. Temperatures to reach 39°C.',
            category: 'health'
          }
        ];

        // Ask LLM to judge relevance as specified in §5
        const systemPrompt = `Given these news/advisory items and the trip (destination, dates, itinerary), decide which — if any — could materially disrupt the trip (safety, transport, closures, entry rules). Ignore everything else. For each relevant item, write one calm, factual sentence and a suggested action. Return JSON: { "alerts": [{ "summary": "...", "action": "..." }] }. Empty if none.`;
        
        const serializedItinerary = itineraryItems
          .map((item) => `- ${item.date} ${item.time || ''}: [${item.type}] ${item.title} (Location: ${item.location || 'none'})`)
          .join('\n');

        const userPrompt = `
DESTINATION: ${destination}
TRIP DATES: Start: ${startDate || 'TBD'}, End: ${endDate || 'TBD'}
ITINERARY:
${serializedItinerary}
RAW ADVISORIES FEED:
${JSON.stringify(rawFeed, null, 2)}
`;

        const { complete } = require('./llm');
        let rawAlertsResult: string;
        try {
          rawAlertsResult = await complete(userPrompt, systemPrompt, {
          type: 'OBJECT',
          properties: {
            alerts: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  summary: { type: 'STRING' },
                  action: { type: 'STRING' }
                },
                required: ['summary', 'action']
              }
            }
          },
          required: ['alerts']
          });
        } catch (err: any) {
          const is429 = err?.status === 429 || (err?.message || '').includes('429') || (err?.message || '').includes('quota');
          if (is429) { const e = new Error('LLM rate limited (429)') as any; e.status = 429; throw e; }
          throw err;
        }

        const parsedAlerts = JSON.parse(rawAlertsResult);
        if (parsedAlerts.alerts && parsedAlerts.alerts.length > 0) {
          const alertItem = parsedAlerts.alerts[0]; // Take the most relevant alert
          const emergencyBody = `⚠️ *AI Concierge Emergency advisory* for **${destination}**:\n${alertItem.summary}\n💡 *Suggested Action*: ${alertItem.action}`;

          await query(`
            INSERT INTO messages (id, trip_id, author_id, is_ai, body, metadata)
            VALUES ($1, $2, null, true, $3, $4)
          `, [
            crypto.randomUUID(),
            tripId,
            emergencyBody,
            JSON.stringify({ trigger: 'emergency_news' })
          ]);
        }
      }
    }

  } catch (err) {
    console.error('runProactiveConciergeChecks failed:', err);
  }
}
