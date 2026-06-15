'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { signFileToken } from '@/lib/signed-url';
import path from 'path';

/**
 * GET /api/trip/[tripId]/vault/download?vaultItemId=<id>
 *
 * Re-signs a fresh 1-hour token for the file attached to a vault item and
 * redirects to the uploads proxy. Callers never need to store or cache the
 * signed URL — they hit this endpoint each time they want to download.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  try {
    await authorizeTripAccess(tripId);
  } catch (err: any) {
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const vaultItemId = req.nextUrl.searchParams.get('vaultItemId');
  if (!vaultItemId) {
    return NextResponse.json({ error: 'Missing vaultItemId' }, { status: 400 });
  }

  const res = await query(
    'SELECT source_file_url FROM vault_items WHERE id = $1 AND trip_id = $2',
    [vaultItemId, tripId]
  );
  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'Vault item not found' }, { status: 404 });
  }

  const storedUrl: string = res.rows[0].source_file_url;
  if (!storedUrl) {
    return NextResponse.json({ error: 'No file attached to this item' }, { status: 404 });
  }

  // Extract the bare filename from the stored URL
  // Stored format: /api/trip/<tripId>/uploads/<filename>?token=<old-token>
  const urlPath = storedUrl.split('?')[0]; // strip stale token
  const filename = path.basename(urlPath);
  if (!filename) {
    return NextResponse.json({ error: 'Cannot resolve filename' }, { status: 500 });
  }

  // Issue a fresh signed token and redirect
  const freshToken = signFileToken(tripId, filename);
  const redirectUrl = `/api/trip/${tripId}/uploads/${filename}?token=${freshToken}`;
  return NextResponse.redirect(new URL(redirectUrl, req.url));
}
