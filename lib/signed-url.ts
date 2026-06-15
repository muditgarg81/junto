'use strict';

import crypto from 'crypto';

const SECRET = process.env.FILE_SECRET || process.env.SESSION_SECRET || 'junto-file-hmac-key-2026-fallback-secret-value';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Generate a short-lived signed token for serving a vault file.
 * Token encodes: tripId + filename + expiry, signed with HMAC-SHA256.
 */
export function signFileToken(tripId: string, filename: string): string {
  const expiry = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const payload = `${tripId}:${filename}:${expiry}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${expiry}.${sig}`;
}

/**
 * Verify a signed file token. Returns true only if valid and not expired.
 */
export function verifyFileToken(tripId: string, filename: string, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expiryStr, sig] = parts;
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Math.floor(Date.now() / 1000) > expiry) return false;

  const payload = `${tripId}:${filename}:${expiry}`;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
