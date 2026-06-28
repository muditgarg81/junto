'use strict';

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { query } from '@/lib/db';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';
import { signFileToken } from '@/lib/signed-url';
import { getCurrentUser } from '@/lib/auth';

// GET — list photos for this trip
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  try {
    await authorizeTripAccess(tripId);
    const res = await query(
      `SELECT sp.id, sp.filename, sp.caption, sp.taken_at, sp.created_at,
              COALESCE(u.name, m.name) AS uploader_name
       FROM scrapbook_photos sp
       LEFT JOIN members m ON sp.uploader_member_id = m.id
       LEFT JOIN users u ON m.user_id = u.id
       WHERE sp.trip_id = $1
       ORDER BY sp.created_at DESC`,
      [tripId]
    );
    const photos = res.rows.map((row) => {
      const token = signFileToken(tripId, row.filename);
      return {
        id: row.id,
        url: `/api/trip/${tripId}/uploads/${row.filename}?token=${token}`,
        caption: row.caption,
        taken_at: row.taken_at,
        created_at: row.created_at,
        uploader_name: row.uploader_name,
      };
    });
    return NextResponse.json({ photos });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — upload a photo
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    const member = await authorizeTripAccess(tripId);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const caption = (formData.get('caption') as string | null) || null;
    const takenAt = (formData.get('taken_at') as string | null) || null;

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 });
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type ||
      (ext === '.png' ? 'image/png' :
       ext === '.webp' ? 'image/webp' :
       'image/jpeg');

    // Store binary in vault_files (same mechanism as vouchers)
    await query(
      `INSERT INTO vault_files (filename, trip_id, mime_type, data) VALUES ($1, $2, $3, $4)`,
      [filename, tripId, mimeType, buffer]
    );

    // Get current user's member row
    const user = await getCurrentUser();
    const memberRes = await query(
      `SELECT id FROM members WHERE trip_id = $1 AND (user_id = $2 OR auth_id = $3) LIMIT 1`,
      [tripId, user?.id ?? null, user?.auth_id ?? null]
    );
    const memberRowId = memberRes.rows[0]?.id ?? null;

    // Save metadata
    const photoRes = await query(
      `INSERT INTO scrapbook_photos (trip_id, uploader_member_id, filename, caption, taken_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tripId, memberRowId, filename, caption, takenAt || null]
    );

    const token = signFileToken(tripId, filename);
    return NextResponse.json({
      id: photoRes.rows[0].id,
      url: `/api/trip/${tripId}/uploads/${filename}?token=${token}`,
    });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[photos] upload error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — remove a photo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    await authorizeTripAccess(tripId);
    const { photoId } = await req.json();
    // Fetch filename first to delete from vault_files too
    const res = await query(
      `DELETE FROM scrapbook_photos WHERE id = $1 AND trip_id = $2 RETURNING filename`,
      [photoId, tripId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await query(`DELETE FROM vault_files WHERE filename = $1`, [res.rows[0].filename]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
