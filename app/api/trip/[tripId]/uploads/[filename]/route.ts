'use strict';

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { query } from '@/lib/db';
import { authorizeTripAccess } from '@/lib/authz';
import { verifyFileToken } from '@/lib/signed-url';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string; filename: string }> }
) {
  const { tripId, filename } = await params;

  // Prevent path traversal
  const safe = path.basename(filename);
  if (safe !== filename || filename.includes('..')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // Verify the short-lived signed token
  const token = req.nextUrl.searchParams.get('token');
  if (!token || !verifyFileToken(tripId, safe, token)) {
    return NextResponse.json({ error: 'Unauthorized or expired link' }, { status: 401 });
  }

  // Verify the requester is a member of this trip
  try {
    await authorizeTripAccess(tripId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the file bytes from Postgres (scoped to this trip to prevent cross-trip access)
  const res = await query(
    'SELECT mime_type, data FROM vault_files WHERE filename = $1 AND trip_id = $2',
    [safe, tripId]
  );
  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const { mime_type, data } = res.rows[0];
  const buffer: Buffer = data; // pg returns BYTEA as a Buffer
  const ext = path.extname(safe).toLowerCase();
  const contentType =
    mime_type ||
    (ext === '.pdf' ? 'application/pdf' :
     ext === '.png' ? 'image/png' :
     ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
     'application/octet-stream');

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${safe}"`,
    },
  });
}
