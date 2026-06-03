'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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
    // 1. Authorize session member access
    await authorizeTripAccess(tripId);

    const { kind, docType, sourceFileUrl, fields } = await req.json();

    if (!kind || !fields) {
      return NextResponse.json({ error: 'Missing kind or fields' }, { status: 400 });
    }

    // Insert into vault_items
    const vaultItemId = crypto.randomUUID();
    await query(
      `INSERT INTO vault_items (id, trip_id, kind, doc_type, source_file_url, fields)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        vaultItemId,
        tripId,
        kind,
        docType || 'image',
        sourceFileUrl || null,
        JSON.stringify(fields)
      ]
    );

    // Generate linked itinerary items
    if (kind === 'stay') {
      const { hotelName, checkInDate, checkOutDate, address } = fields;
      if (checkInDate) {
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(checkInDate),
            '15:00:00', // standard check-in time
            'stay',
            `Check-in: ${hotelName || 'Hotel Stay'}`,
            address || null,
            vaultItemId
          ]
        );
      }
      if (checkOutDate) {
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(checkOutDate),
            '11:00:00', // standard check-out time
            'stay',
            `Check-out: ${hotelName || 'Hotel Stay'}`,
            address || null,
            vaultItemId
          ]
        );
      }
    } else if (kind === 'flight') {
      const { airline, flightNo, departureDate, departureTime, departureAirport, arrivalAirport } = fields;
      if (departureDate) {
        const timeStr = formatDbTime(departureTime) || null;
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(departureDate),
            timeStr,
            'flight',
            `${airline || 'Flight'} ${flightNo || ''} departure`.trim(),
            departureAirport && arrivalAirport ? `${departureAirport} to ${arrivalAirport}` : null,
            vaultItemId
          ]
        );
      }

      // Trigger eSIM & Forex offers
      try {
        const { triggerOffers } = require('@/lib/offers');
        triggerOffers(tripId, 'flight_voucher_ingested').catch(console.error);
      } catch (err) {
        console.error('Failed to trigger flight offers:', err);
      }
    } else if (kind === 'activity') {
      const { activityName, date, time, location } = fields;
      if (date) {
        const timeStr = formatDbTime(time) || null;
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(date),
            timeStr,
            'activity',
            activityName || 'Activity',
            location || null,
            vaultItemId
          ]
        );
      }
    } else if (kind === 'contact') {
      // Contacts do not generally map to Itinerary timelines
    } else {
      // kind === 'other'
      const { title, date, time, location, description } = fields;
      if (date) {
        const timeStr = formatDbTime(time) || null;
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(date),
            timeStr,
            'other',
            title || 'Voucher Item',
            location || description || null,
            vaultItemId
          ]
        );
      }
    }

    return NextResponse.json({ success: true, vaultItemId });

  } catch (err: any) {
    console.error('Vault commit failed:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    // 1. Authorize session member access
    await authorizeTripAccess(tripId);

    const { vaultItemId, kind, fields } = await req.json();
    if (!vaultItemId || !kind || !fields) {
      return NextResponse.json({ error: 'Missing vaultItemId, kind, or fields' }, { status: 400 });
    }

    // 2. Update vault_items (enforce trip_id matching to prevent cross-trip BOLA)
    const updateRes = await query(
      'UPDATE vault_items SET kind = $1, fields = $2 WHERE id = $3 AND trip_id = $4',
      [kind, JSON.stringify(fields), vaultItemId, tripId]
    );

    if (updateRes.rowCount === 0) {
      return NextResponse.json({ error: 'Vault item not found in this trip.' }, { status: 404 });
    }

    // Delete existing linked itinerary items
    await query('DELETE FROM itinerary_items WHERE source_vault_item_id = $1 AND trip_id = $2', [vaultItemId, tripId]);

    // Re-insert itinerary items based on updated fields
    if (kind === 'stay') {
      const { hotelName, checkInDate, checkOutDate, address } = fields;
      if (checkInDate) {
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(checkInDate),
            '15:00:00',
            'stay',
            `Check-in: ${hotelName || 'Hotel Stay'}`,
            address || null,
            vaultItemId
          ]
        );
      }
      if (checkOutDate) {
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(checkOutDate),
            '11:00:00',
            'stay',
            `Check-out: ${hotelName || 'Hotel Stay'}`,
            address || null,
            vaultItemId
          ]
        );
      }
    } else if (kind === 'flight') {
      const { airline, flightNo, departureDate, departureTime, departureAirport, arrivalAirport } = fields;
      if (departureDate) {
        const timeStr = formatDbTime(departureTime) || null;
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(departureDate),
            timeStr,
            'flight',
            `${airline || 'Flight'} ${flightNo || ''} departure`.trim(),
            departureAirport && arrivalAirport ? `${departureAirport} to ${arrivalAirport}` : null,
            vaultItemId
          ]
        );
      }
    } else if (kind === 'activity') {
      const { activityName, date, time, location } = fields;
      if (date) {
        const timeStr = formatDbTime(time) || null;
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(date),
            timeStr,
            'activity',
            activityName || 'Activity',
            location || null,
            vaultItemId
          ]
        );
      }
    } else {
      const { title, date, time, location, description } = fields;
      if (date) {
        const timeStr = formatDbTime(time) || null;
        await query(
          `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            tripId,
            formatDbDate(date),
            timeStr,
            'other',
            title || 'Voucher Item',
            location || description || null,
            vaultItemId
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Vault update failed:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    // 1. Authorize session member access
    await authorizeTripAccess(tripId);

    const { vaultItemId } = await req.json();
    if (!vaultItemId) {
      return NextResponse.json({ error: 'Missing vaultItemId' }, { status: 400 });
    }

    // 2. Delete linked itinerary items (enforce trip_id matching to prevent IDOR)
    const deleteItin = await query('DELETE FROM itinerary_items WHERE source_vault_item_id = $1 AND trip_id = $2', [vaultItemId, tripId]);
    
    // 3. Delete vault item itself (enforce trip_id matching)
    const deleteVault = await query('DELETE FROM vault_items WHERE id = $1 AND trip_id = $2', [vaultItemId, tripId]);

    if (deleteVault.rowCount === 0) {
      return NextResponse.json({ error: 'Vault item not found in this trip.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Vault delete failed:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// Format client dates to YYYY-MM-DD
function formatDbDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return dateStr;
}

// Normalize check-in or departure times to HH:MM:SS
function formatDbTime(timeStr: string): string | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const hrsStr = hours.toString().padStart(2, '0');
    return `${hrsStr}:${minutes}:00`;
  }
  if (/^\d{2}:\d{2}$/.test(clean)) {
    return `${clean}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(clean)) {
    return clean;
  }
  return null;
}
