import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectPath = searchParams.get('redirect') || '/home';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error('GOOGLE_CLIENT_ID is not configured in environment variables.');
    return NextResponse.json(
      { error: 'Google Sign-In is not configured on this server.' },
      { status: 500 }
    );
  }

  // Determine host and protocol dynamically to support localhost, local LAN IP, and production Vercel
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('192.168.') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/callback/google`;

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', redirectPath);
  googleAuthUrl.searchParams.set('prompt', 'select_account'); // Force account selection UI

  return NextResponse.redirect(googleAuthUrl.toString());
}
