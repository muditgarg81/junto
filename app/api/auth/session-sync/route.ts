import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';

const IS_PROD = process.env.NODE_ENV === 'production';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Set the session cookies securely in the WebView browser context
  const cookieStore = await cookies();
  const base = { path: '/', maxAge: 60 * 60 * 24 * 30, httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const };
  cookieStore.set('junto_user_id', token, base);
  cookieStore.set('junto_has_profile', 'true', base);
  cookieStore.set('junto_show_packing_reminder', 'true', { ...base, httpOnly: false });

  return NextResponse.json({ success: true });
}
