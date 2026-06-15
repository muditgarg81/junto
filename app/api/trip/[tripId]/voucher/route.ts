'use strict';

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { completeVision } from '@/lib/llm';
import { query } from '@/lib/db';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';
import { signFileToken } from '@/lib/signed-url';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;

  try {
    // Gating check
    await authorizeTripAccess(tripId);

    // Fetch trip start date from the locked dates decision so the OCR prompt
    // can resolve "Day 1" → actual calendar date for day-wise itineraries.
    const datesRes = await query(
      `SELECT o.payload FROM decisions d
       JOIN options o ON d.resolved_option_id = o.id
       WHERE d.trip_id = $1 AND d.type = 'dates' AND d.status = 'locked'
       LIMIT 1`,
      [tripId]
    );
    const datesPayload = datesRes.rows[0]?.payload;
    const parsedDates = datesPayload
      ? (typeof datesPayload === 'string' ? JSON.parse(datesPayload) : datesPayload)
      : null;
    const tripStartDate: string | null = parsedDates?.startDate
      ? String(parsedDates.startDate).split('T')[0]
      : null;

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 1. Persist the file bytes in Postgres (Vercel serverless FS is read-only).
    const fileExtension = path.extname(file.name) || '.png';
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}${fileExtension}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    // file.type may be empty on Android WebView / some browsers — infer from extension.
    const extLower = fileExtension.toLowerCase();
    const mimeType = file.type ||
      (extLower === '.pdf'  ? 'application/pdf' :
       extLower === '.jpg' || extLower === '.jpeg' ? 'image/jpeg' :
       extLower === '.png'  ? 'image/png' :
       'application/octet-stream');

    await query(
      `INSERT INTO vault_files (filename, trip_id, mime_type, data)
       VALUES ($1, $2, $3, $4)`,
      [fileName, tripId, mimeType, buffer]
    );

    // Build a signed, short-lived URL served through the auth-gated proxy route
    const token = signFileToken(tripId, fileName);
    const relativeUrl = `/api/trip/${tripId}/uploads/${fileName}?token=${token}`;

    // 2. Call Gemini Vision
    const systemPrompt = `You are a highly precise document OCR extraction tool specialized in travel documents (flights, hotels, bookings).`;
    const tripStartNote = tripStartDate
      ? `\nThe trip starts on ${tripStartDate}. Use this to resolve relative day references: "Day 1" = ${tripStartDate}, "Day 2" = the next day, etc.`
      : '';

    const prompt = `Analyze this travel voucher/booking confirmation document.
Extract the relevant details into a structured JSON format.

First, determine the category ('flight', 'stay', 'activity', 'itinerary', or 'other').
Use 'itinerary' when the document is a MULTI-ITEM trip plan covering more than one booking type (e.g. flights AND a hotel AND day-by-day activities), OR when it is a day-wise/day-by-day schedule listing activities across multiple days. Use the single categories only for a single booking voucher.
Then extract the following fields depending on the category:
- flight: a "segments" ARRAY. The document may contain multiple legs (e.g. a round trip or a connecting itinerary) — extract EVERY leg as a separate segment. Each segment has: flightNo, departureTime (format: HH:MM or HH:MM AM/PM), departureDate (YYYY-MM-DD), arrivalTime (HH:MM or HH:MM AM/PM, if shown), arrivalDate (YYYY-MM-DD, if shown — may differ from departureDate for overnight/long-haul), airline, pnr, departureAirport (IATA code), arrivalAirport (IATA code). Always return "segments" as an array, even if there is only one flight.
- stay: hotelName, checkInDate, checkOutDate, confirmationNo, address
- activity: activityName, date, time, location, confirmationNo
- itinerary: { tripName, flights: [ ...same shape as flight segments... ], stays: [ { hotelName, checkInDate, checkOutDate, address } ], activities: [ { activityName, date (YYYY-MM-DD), time (HH:MM or HH:MM AM/PM), location } ] }. Extract EVERY flight leg, stay, and activity you find. For airports, ALWAYS use the IATA code (e.g. 'DEL', 'NAG', 'JDH').
  IMPORTANT for day-wise itineraries: if the document lists activities under "Day 1", "Day 2" headings (with or without calendar dates), assign each activity the correct YYYY-MM-DD date. If the document shows a calendar date alongside the day heading (e.g. "Day 1 - 24 Jun"), use that date. If only a day number is shown, calculate the date from the trip start.${tripStartNote}
  Every activity MUST have a date field set to a valid YYYY-MM-DD string — do not omit it.
- other: title, date, description

For any date field, extract it exactly as it appears and convert to YYYY-MM-DD format.
Also, analyze if the dates are written in an ambiguous numerical format (e.g. DD/MM/YYYY or MM/DD/YYYY where both Day and Month numbers are 12 or less, such as '05/06/2026', meaning it could be either May 6 or June 5).
Set ambiguousDateDetected to true if such ambiguity exists, otherwise set it to false.

Return a JSON object in this exact format (do not include markdown code block styling, return raw JSON string):
{
  "kind": "flight" | "stay" | "activity" | "itinerary" | "other",
  "fields": {
    // category-specific fields here
  },
  "ambiguousDateDetected": boolean
}`;

    let ocrResultText = '';
    try {
      ocrResultText = await completeVision(buffer, mimeType, prompt, systemPrompt);
      console.log('Voucher OCR raw output:', ocrResultText);
    } catch (ocrErr: any) {
      console.error('Vision OCR completed with error, falling back:', ocrErr);
      // Fallback in case Gemini API is blocked or key is invalid during tests
      return NextResponse.json({
        kind: 'other',
        fields: {
          title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
          description: 'Uploaded voucher file (auto-extracted fallback)'
        },
        sourceFileUrl: `/api/trip/${tripId}/uploads/${fileName}?token=${token}`,
        ambiguousDateDetected: false
      });
    }

    // Extract JSON from the response — Gemini may wrap it in ```json fences or
    // add preamble text when responseMimeType is not enforced.
    let cleanedJson = ocrResultText.trim();
    // Strip markdown fences
    if (cleanedJson.includes('```')) {
      cleanedJson = cleanedJson.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    }
    // Extract the outermost JSON object if there is surrounding text
    const firstBrace = cleanedJson.indexOf('{');
    const lastBrace = cleanedJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanedJson = cleanedJson.slice(firstBrace, lastBrace + 1);
    }
    console.log('Voucher OCR cleaned JSON (first 500):', cleanedJson.slice(0, 500));

    const parsedOcr = JSON.parse(cleanedJson);

    let kind = parsedOcr.kind || 'other';
    let fields = parsedOcr.fields || {};

    // Lenient reclassification: an "other" doc that actually carries multiple
    // item arrays is really a full itinerary.
    if (kind === 'other' && (Array.isArray(fields.flights) || Array.isArray(fields.activities) || fields.accommodation)) {
      kind = 'itinerary';
    }

    if (kind === 'flight') {
      // Normalise multi-segment flights. Gemini returns legs under `segments`
      // (or sometimes `flights`). Keep the full array, and flatten the first
      // leg to the top level so the single-flight confirmation form populates.
      const segs = Array.isArray(fields.segments)
        ? fields.segments
        : Array.isArray(fields.flights)
        ? fields.flights
        : null;
      if (segs && segs.length > 0) {
        fields = { ...normalizeFlight(segs[0]), segments: segs.map(normalizeFlight) };
      } else if (Object.keys(fields).length > 0) {
        const f = normalizeFlight(fields);
        fields = { ...f, segments: [f] };
      }
    } else if (kind === 'itinerary') {
      const accom = fields.accommodation;
      const rawActivities: any[] = Array.isArray(fields.activities) ? fields.activities : [];

      // Post-process activity dates: convert "Day N" / "Day N - <label>" / null
      // to YYYY-MM-DD using the trip start date so day-wise itineraries work
      // even when the LLM returns relative day references.
      const resolvedActivities = rawActivities.map((a: any) => {
        const d = String(a.date || '').trim();
        // Already a valid date — keep as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return a;
        // "Day N" or "Day N - ..." pattern
        const dayMatch = d.match(/^day\s*(\d+)/i);
        if (dayMatch && tripStartDate) {
          const offset = parseInt(dayMatch[1], 10) - 1; // Day 1 = offset 0
          const [y, m, day] = tripStartDate.split('-').map(Number);
          const dt = new Date(y, m - 1, day + offset);
          const resolved = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
          return { ...a, date: resolved };
        }
        // Try JS date parse for formats like "25 Jun 2026"
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
          return { ...a, date: parsed.toISOString().split('T')[0] };
        }
        // No date found — leave as-is (will be skipped by addActivity)
        return a;
      });

      fields = {
        tripName: fields.tripName || fields.title || 'Trip Itinerary',
        flights: Array.isArray(fields.flights) ? fields.flights.map(normalizeFlight) : [],
        stays: Array.isArray(fields.stays)
          ? fields.stays
          : accom
          ? [accom]
          : [],
        activities: resolvedActivities,
      };
      console.log('Itinerary activities after date resolution (first 3):', resolvedActivities.slice(0, 3));
    }

    return NextResponse.json({
      kind,
      fields,
      sourceFileUrl: relativeUrl,
      ambiguousDateDetected: !!parsedOcr.ambiguousDateDetected
    });

  } catch (err: any) {
    console.error('Voucher upload/OCR failed:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error during voucher processing' }, { status: 500 });
  }
}

// Extract a 3-letter IATA code from values like "Nagpur (NAG)", "NAG", "New Delhi".
function toIata(v?: string | null): string | null {
  if (!v) return null;
  const paren = String(v).match(/\(([A-Za-z]{3})\)/);
  if (paren) return paren[1].toUpperCase();
  const bare = String(v).trim().match(/^([A-Za-z]{3})$/);
  if (bare) return bare[1].toUpperCase();
  return String(v).trim(); // leave city name; airportTz() will default the zone
}

// Coerce a flight object (segment OR itinerary-flight shape) into the canonical
// segment shape the commit route expects.
function normalizeFlight(f: any): any {
  if (!f || typeof f !== 'object') return f;
  return {
    airline: f.airline ?? null,
    flightNo: f.flightNo ?? f.flightNumber ?? null,
    pnr: f.pnr ?? f.confirmationNo ?? null,
    departureDate: f.departureDate ?? f.date ?? null,
    departureTime: f.departureTime ?? null,
    arrivalDate: f.arrivalDate ?? f.date ?? null,
    arrivalTime: f.arrivalTime ?? null,
    departureAirport: toIata(f.departureAirport),
    arrivalAirport: toIata(f.arrivalAirport),
  };
}
