'use server';

import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { signSessionToken } from '@/lib/auth';

export async function signinAction(authId: string, email: string, name: string) {
  const cookieStore = await cookies();
  
  // 1. Set the auth session cookie (httpOnly, secure, sameSite: lax)
  const sessionPayload = { auth_id: authId, email, name };
  cookieStore.set('junto_auth_session', JSON.stringify(sessionPayload), {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  // 2. Check if a profile already exists for this auth_id
  const userRes = await query('SELECT * FROM users WHERE auth_id = $1', [authId]);
  
  if (userRes.rows.length > 0) {
    const user = userRes.rows[0];
    // Cryptographically sign the session cookie
    const signedToken = signSessionToken(user.id);
    
    cookieStore.set('junto_user_id', signedToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    cookieStore.set('junto_has_profile', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    cookieStore.set('junto_show_packing_reminder', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
    });
    return { success: true, hasProfile: true };
  } else {
    cookieStore.delete('junto_user_id');
    cookieStore.set('junto_has_profile', 'false', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    return { success: true, hasProfile: false };
  }
}
