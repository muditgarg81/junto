'use server';

import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { signSessionToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const IS_PROD = process.env.NODE_ENV === 'production';

async function setSessionCookies(cookieStore: Awaited<ReturnType<typeof cookies>>, userId: string) {
  const signedToken = signSessionToken(userId);
  const base = { path: '/', maxAge: 60 * 60 * 24 * 30, httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const };
  cookieStore.set('junto_user_id', signedToken, base);
  cookieStore.set('junto_has_profile', 'true', base);
  cookieStore.set('junto_show_packing_reminder', 'true', { ...base, httpOnly: false });
}

export async function passwordSigninAction(email: string, password: string, redirectPath: string) {
  const cookieStore = await cookies();
  const trimEmail = email.trim().toLowerCase();

  const userRes = await query('SELECT * FROM users WHERE email = $1', [trimEmail]);

  if (userRes.rows.length > 0) {
    const user = userRes.rows[0];
    if (!user.password_hash) {
      return { success: false, error: 'This account uses Google sign-in. Please use "Continue with Google".' };
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return { success: false, error: 'Incorrect password.' };
    await setSessionCookies(cookieStore, user.id);
    return { success: true, redirectTo: redirectPath };
  }

  return { success: false, error: 'Account does not exist. Please sign up first.' };
}

export async function passwordSignupAction(email: string, password: string, redirectPath: string) {
  const cookieStore = await cookies();
  const trimEmail = email.trim().toLowerCase();

  const userRes = await query('SELECT * FROM users WHERE email = $1', [trimEmail]);

  if (userRes.rows.length > 0) {
    return { success: false, error: 'An account with this email already exists. Please sign in.' };
  }

  // New user — create account with hashed password
  const hash = await bcrypt.hash(password, 10);
  const displayName = trimEmail.split('@')[0];
  const authId = `email-${trimEmail.replace(/[^a-z0-9]/g, '-')}`;

  const newUser = await query(
    `INSERT INTO users (auth_id, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
    [authId, trimEmail, displayName, hash]
  );
  await setSessionCookies(cookieStore, newUser.rows[0].id);
  return { success: true, redirectTo: redirectPath };
}

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
