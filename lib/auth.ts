import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { User } from './types';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'junto-session-hmac-key-2026-fallback-secret-value';

// Sign token with HMAC-SHA256
export function signSessionToken(userId: string): string {
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(userId)
    .digest('base64url');
  return `${userId}.${signature}`;
}

// Verify signed token and return raw userId
export function verifySessionToken(token: string): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(userId)
    .digest('base64url');
  
  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    return isMatch ? userId : null;
  } catch (e) {
    return null;
  }
}

export async function getCurrentUser(allowFallback = false): Promise<User | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('junto_user_id')?.value;
  if (tokenCookie) {
    const userId = verifySessionToken(tokenCookie);
    if (userId) {
      const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length > 0) {
        return userRes.rows[0];
      }
    }
  }

  // Developer backdoor restricted strictly to development mode
  if (allowFallback && process.env.NODE_ENV === 'development') {
    const userRes = await query("SELECT * FROM users WHERE auth_id = 'default-mudit-garg'");
    if (userRes.rows.length > 0) {
      return userRes.rows[0];
    }
  }

  return null;
}
