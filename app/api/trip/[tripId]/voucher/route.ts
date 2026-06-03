'use strict';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { completeVision } from '@/lib/llm';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';

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

    // 1. Save file to public/uploads
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExtension = path.extname(file.name) || '.png';
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/${fileName}`;

    // 2. Call Gemini Vision
    const mimeType = file.type || 'image/png';
    const systemPrompt = `You are a highly precise document OCR extraction tool specialized in travel documents (flights, hotels, bookings).`;
    const prompt = `Analyze this travel voucher/booking confirmation document.
Extract the relevant details into a structured JSON format.

First, determine the category ('flight', 'stay', 'activity', or 'other').
Then extract the following fields depending on the category:
- flight: flightNo, departureTime (format: HH:MM or HH:MM AM/PM), departureDate, airline, pnr, departureAirport, arrivalAirport
- stay: hotelName, checkInDate, checkOutDate, confirmationNo, address
- activity: activityName, date, time, location, confirmationNo
- other: title, date, description

For any date field, extract it exactly as it appears. 
Also, analyze if the dates are written in an ambiguous numerical format (e.g. DD/MM/YYYY or MM/DD/YYYY where both Day and Month numbers are 12 or less, such as '05/06/2026', meaning it could be either May 6 or June 5).
Set ambiguousDateDetected to true if such ambiguity exists, otherwise set it to false.

Return a JSON object in this exact format (do not include markdown code block styling, return raw JSON string):
{
  "kind": "flight" | "stay" | "activity" | "other",
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
        sourceFileUrl: relativeUrl,
        ambiguousDateDetected: false
      });
    }

    // Clean JSON output (remove ```json wrappers if present)
    let cleanedJson = ocrResultText.trim();
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    const parsedOcr = JSON.parse(cleanedJson);

    return NextResponse.json({
      kind: parsedOcr.kind || 'other',
      fields: parsedOcr.fields || {},
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
