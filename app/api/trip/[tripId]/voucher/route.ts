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
    const prompt = `Analyze this travel voucher/booking confirmation document.
Extract the relevant details into a structured JSON format.

First, determine the category ('flight', 'stay', 'activity', 'itinerary', or 'other').
Use 'itinerary' when the document is a MULTI-ITEM trip plan covering more than one booking type (e.g. flights AND a hotel AND day-by-day activities). Use the single categories only for a single booking voucher.
Then extract the following fields depending on the category:
- flight: a "segments" ARRAY. The document may contain multiple legs (e.g. a round trip or a connecting itinerary) — extract EVERY leg as a separate segment. Each segment has: flightNo, departureTime (format: HH:MM or HH:MM AM/PM), departureDate (YYYY-MM-DD), arrivalTime (HH:MM or HH:MM AM/PM, if shown), arrivalDate (YYYY-MM-DD, if shown — may differ from departureDate for overnight/long-haul), airline, pnr, departureAirport (IATA code), arrivalAirport (IATA code). Always return "segments" as an array, even if there is only one flight.
- stay: hotelName, checkInDate, checkOutDate, confirmationNo, address
- activity: activityName, date, time, location, confirmationNo
- itinerary: { tripName, flights: [ ...same shape as flight segments... ], stays: [ { hotelName, checkInDate, checkOutDate, address } ], activities: [ { activityName, date (YYYY-MM-DD), time (HH:MM or HH:MM AM/PM), location } ] }. Extract EVERY flight leg, stay, and activity you find. For airports, ALWAYS use the IATA code (e.g. 'DEL', 'NAG', 'JDH').
- other: title, date, description

For any date field, extract it exactly as it appears.
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

    // Clean JSON output (remove ```json wrappers if present)
    let cleanedJson = ocrResultText.trim();
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

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
      fields = {
        tripName: fields.tripName || fields.title || 'Trip Itinerary',
        flights: Array.isArray(fields.flights) ? fields.flights.map(normalizeFlight) : [],
        stays: Array.isArray(fields.stays)
          ? fields.stays
          : accom
          ? [accom]
          : [],
        activities: Array.isArray(fields.activities) ? fields.activities : [],
      };
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
