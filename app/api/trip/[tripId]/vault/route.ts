'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';
import { airportTz, localToInstantISO } from '@/lib/airport-tz';

/**
 * Insert an itinerary item, or upgrade an existing equivalent one (dedup).
 * Dedup key: same trip + type + date + title. This prevents duplicates when a
 * flight appears in both a single-voucher upload and a full-itinerary import,
 * or when the same document is uploaded twice. On a match we refresh the
 * structured fields so older rows (created before tz support) gain starts_at/tz.
 */
async function upsertItineraryItem(p: {
  tripId: string; type: string; date: string; title: string;
  time?: string | null; location?: string | null; sourceVaultItemId?: string | null;
  startsAt?: string | null; endsAt?: string | null; tz?: string | null;
}): Promise<void> {
  const existing = await query(
    'SELECT id FROM itinerary_items WHERE trip_id = $1 AND type = $2 AND date = $3 AND title = $4 LIMIT 1',
    [p.tripId, p.type, p.date, p.title]
  );
  if (existing.rows.length > 0) {
    await query(
      `UPDATE itinerary_items
         SET time = COALESCE($2, time),
             location = COALESCE($3, location),
             starts_at = COALESCE($4, starts_at),
             ends_at = COALESCE($5, ends_at),
             tz = COALESCE($6, tz)
       WHERE id = $1`,
      [existing.rows[0].id, p.time ?? null, p.location ?? null, p.startsAt ?? null, p.endsAt ?? null, p.tz ?? null]
    );
    return;
  }
  await query(
    `INSERT INTO itinerary_items (id, trip_id, date, time, type, title, location, source_vault_item_id, starts_at, ends_at, tz)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [crypto.randomUUID(), p.tripId, p.date, p.time ?? null, p.type, p.title, p.location ?? null, p.sourceVaultItemId ?? null, p.startsAt ?? null, p.endsAt ?? null, p.tz ?? null]
  );
}

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
    // Local insert helpers — all route through upsertItineraryItem so repeated
    // uploads / full-itinerary imports dedup instead of duplicating.
    const addFlightSeg = async (seg: any) => {
      const { airline, flightNo, departureDate, departureTime, arrivalDate, arrivalTime, departureAirport, arrivalAirport } = seg || {};
      if (!departureDate) return;
      const timeStr = formatDbTime(departureTime) || null;
      const depTz = airportTz(departureAirport);
      const arrTz = airportTz(arrivalAirport);
      await upsertItineraryItem({
        tripId, type: 'flight', date: formatDbDate(departureDate), time: timeStr,
        title: `${airline || 'Flight'} ${flightNo || ''} departure`.trim(),
        location: departureAirport && arrivalAirport ? `${departureAirport} to ${arrivalAirport}` : null,
        sourceVaultItemId: vaultItemId,
        startsAt: localToInstantISO(formatDbDate(departureDate), timeStr || undefined, depTz),
        endsAt: arrivalTime ? localToInstantISO(formatDbDate(arrivalDate || departureDate), formatDbTime(arrivalTime) || undefined, arrTz) : null,
        tz: depTz,
      });
    };
    const addStay = async (s: any) => {
      const { hotelName, checkInDate, checkOutDate, address } = s || {};
      if (checkInDate) {
        await upsertItineraryItem({ tripId, type: 'stay', date: formatDbDate(checkInDate), time: '15:00:00', title: `Check-in: ${hotelName || 'Hotel Stay'}`, location: address || null, sourceVaultItemId: vaultItemId });
      }
      if (checkOutDate) {
        await upsertItineraryItem({ tripId, type: 'stay', date: formatDbDate(checkOutDate), time: '11:00:00', title: `Check-out: ${hotelName || 'Hotel Stay'}`, location: address || null, sourceVaultItemId: vaultItemId });
      }
    };
    const addActivity = async (a: any) => {
      const { activityName, date, time, location } = a || {};
      if (!date) return;
      await upsertItineraryItem({ tripId, type: 'activity', date: formatDbDate(date), time: formatDbTime(time) || null, title: activityName || 'Activity', location: location || null, sourceVaultItemId: vaultItemId });
    };

    if (kind === 'stay') {
      await addStay(fields);
    } else if (kind === 'flight') {
      // Support multi-segment tickets: one itinerary item per leg.
      const segments = Array.isArray(fields.segments) && fields.segments.length > 0 ? fields.segments : [fields];
      for (const seg of segments) await addFlightSeg(seg);

      try {
        const { triggerOffers } = require('@/lib/offers');
        triggerOffers(tripId, 'flight_voucher_ingested').catch(console.error);
      } catch (err) {
        console.error('Failed to trigger flight offers:', err);
      }
    } else if (kind === 'activity') {
      await addActivity(fields);
    } else if (kind === 'itinerary') {
      // Full trip plan → explode into many itinerary items (flights, stays, activities).
      const flights = Array.isArray(fields.flights) ? fields.flights : [];
      console.log('[vault POST] itinerary kind — flights:', flights.length, 'stays:', (fields.stays||[]).length, 'activities:', (fields.activities||[]).length);
      console.log('[vault POST] first activity sample:', JSON.stringify(fields.activities?.[0]));
      for (const seg of flights) await addFlightSeg(seg);
      for (const s of (Array.isArray(fields.stays) ? fields.stays : [])) await addStay(s);
      let activityCount = 0;
      for (const a of (Array.isArray(fields.activities) ? fields.activities : [])) {
        try {
          await addActivity(a);
          activityCount++;
        } catch (aErr: any) {
          console.error('[vault POST] addActivity failed for', JSON.stringify(a), aErr?.message);
        }
      }
      console.log('[vault POST] activities inserted/upserted:', activityCount);

      if (flights.length > 0) {
        try {
          const { triggerOffers } = require('@/lib/offers');
          triggerOffers(tripId, 'flight_voucher_ingested').catch(console.error);
        } catch (err) {
          console.error('Failed to trigger flight offers:', err);
        }
      }
    } else if (kind === 'contact') {
      // Contacts do not generally map to Itinerary timelines
    } else {
      // kind === 'other'
      const { title, date, time, location, description } = fields;
      if (date) {
        await upsertItineraryItem({ tripId, type: 'other', date: formatDbDate(date), time: formatDbTime(time) || null, title: title || 'Voucher Item', location: location || description || null, sourceVaultItemId: vaultItemId });
      }
    }

    revalidatePath(`/trip/${tripId}/itinerary`);
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

    // Re-insert itinerary items based on updated fields (dedup-aware).
    const addFlightSeg = async (seg: any) => {
      const { airline, flightNo, departureDate, departureTime, arrivalDate, arrivalTime, departureAirport, arrivalAirport } = seg || {};
      if (!departureDate) return;
      const timeStr = formatDbTime(departureTime) || null;
      const depTz = airportTz(departureAirport);
      const arrTz = airportTz(arrivalAirport);
      await upsertItineraryItem({
        tripId, type: 'flight', date: formatDbDate(departureDate), time: timeStr,
        title: `${airline || 'Flight'} ${flightNo || ''} departure`.trim(),
        location: departureAirport && arrivalAirport ? `${departureAirport} to ${arrivalAirport}` : null,
        sourceVaultItemId: vaultItemId,
        startsAt: localToInstantISO(formatDbDate(departureDate), timeStr || undefined, depTz),
        endsAt: arrivalTime ? localToInstantISO(formatDbDate(arrivalDate || departureDate), formatDbTime(arrivalTime) || undefined, arrTz) : null,
        tz: depTz,
      });
    };
    const addStay = async (s: any) => {
      const { hotelName, checkInDate, checkOutDate, address } = s || {};
      if (checkInDate) await upsertItineraryItem({ tripId, type: 'stay', date: formatDbDate(checkInDate), time: '15:00:00', title: `Check-in: ${hotelName || 'Hotel Stay'}`, location: address || null, sourceVaultItemId: vaultItemId });
      if (checkOutDate) await upsertItineraryItem({ tripId, type: 'stay', date: formatDbDate(checkOutDate), time: '11:00:00', title: `Check-out: ${hotelName || 'Hotel Stay'}`, location: address || null, sourceVaultItemId: vaultItemId });
    };
    const addActivity = async (a: any) => {
      const { activityName, date, time, location } = a || {};
      if (!date) return;
      await upsertItineraryItem({ tripId, type: 'activity', date: formatDbDate(date), time: formatDbTime(time) || null, title: activityName || 'Activity', location: location || null, sourceVaultItemId: vaultItemId });
    };

    if (kind === 'stay') {
      await addStay(fields);
    } else if (kind === 'flight') {
      const segments = Array.isArray(fields.segments) && fields.segments.length > 0 ? fields.segments : [fields];
      for (const seg of segments) await addFlightSeg(seg);
    } else if (kind === 'activity') {
      await addActivity(fields);
    } else if (kind === 'itinerary') {
      for (const seg of (Array.isArray(fields.flights) ? fields.flights : [])) await addFlightSeg(seg);
      for (const s of (Array.isArray(fields.stays) ? fields.stays : [])) await addStay(s);
      for (const a of (Array.isArray(fields.activities) ? fields.activities : [])) await addActivity(a);
    } else if (kind === 'contact') {
      // Contacts do not map to the itinerary timeline
    } else {
      const { title, date, time, location, description } = fields;
      if (date) {
        await upsertItineraryItem({ tripId, type: 'other', date: formatDbDate(date), time: formatDbTime(time) || null, title: title || 'Voucher Item', location: location || description || null, sourceVaultItemId: vaultItemId });
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
