import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signSessionToken } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  try {
    const { name, email, photoUrl, upiId, homeCurrency } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authSessionCookie = cookieStore.get('junto_auth_session')?.value;
    let authId = `user-${crypto.randomUUID().substring(0, 8)}`;
    if (authSessionCookie) {
      try {
        const session = JSON.parse(authSessionCookie);
        if (session.auth_id) {
          authId = session.auth_id;
        }
      } catch (e) {}
    }

    // 1. Check if user already exists by email (case-insensitive check)
    const existingUser = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    
    let user;
    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];
      // Update existing user details
      const updateRes = await query(
        `UPDATE users
         SET name = $1,
             photo_url = COALESCE($2, photo_url),
             upi_id = COALESCE($3, upi_id),
             home_currency = COALESCE($4, home_currency),
             auth_id = COALESCE($5, auth_id)
         WHERE id = $6
         RETURNING *`,
        [name.trim(), photoUrl?.trim() || null, upiId?.trim() || null, homeCurrency || 'INR', authId, user.id]
      );
      user = updateRes.rows[0];
    } else {
      // Create new user
      const id = crypto.randomUUID();
      const insertRes = await query(
        `INSERT INTO users (id, auth_id, name, email, photo_url, upi_id, home_currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, authId, name.trim(), email.trim(), photoUrl?.trim() || null, upiId?.trim() || null, homeCurrency || 'INR']
      );
      user = insertRes.rows[0];
    }

    // If auth session doesn't exist, seed it with details
    if (!authSessionCookie) {
      cookieStore.set('junto_auth_session', JSON.stringify({ auth_id: authId, email: email.trim(), name: name.trim() }), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });
    }

    // 2. Set user ID and has_profile state in cookies securely
    const signedToken = signSessionToken(user.id);
    cookieStore.set('junto_user_id', signedToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
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

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    console.error('Error during onboarding:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
