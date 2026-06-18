import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { signSessionToken } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '/home'; // state contains the original redirectPath
  const error = searchParams.get('error');

  const isNative = state.startsWith('native:');
  const cleanState = isNative ? state.replace('native:', '') : state;

  const handleRedirect = (destination: string) => {
    if (isNative) {
      // For native (Capacitor Custom Chrome Tab): redirect to /auth-done.
      // The browserFinished listener in the app detects tab close and navigates the WebView.
      const authDoneUrl = `/auth-done?redirect=${encodeURIComponent(destination)}`;
      return NextResponse.redirect(new URL(authDoneUrl, request.url));
    }
    return NextResponse.redirect(new URL(destination, request.url));
  };

  if (error) {
    console.error('Google OAuth error returned from Google:', error);
    return handleRedirect(`/signin?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('No authorization code returned from Google.');
    return handleRedirect('/signin?error=no_auth_code');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Google Client credentials are not configured.');
    return handleRedirect('/signin?error=credentials_missing');
  }

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('192.168.') ? 'http' : 'https';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('192.168.');
  const canonicalOrigin = process.env.NEXT_PUBLIC_APP_URL || (isLocal ? `${protocol}://${host}` : 'https://junto-three.vercel.app');
  const redirectUri = `${canonicalOrigin}/api/auth/callback/google`;

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for tokens:', errorText);
      return handleRedirect('/signin?error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token returned from Google.');
      return handleRedirect('/signin?error=no_access_token');
    }

    // 2. Fetch user profile information using the access token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to retrieve user info from Google.');
      return handleRedirect('/signin?error=user_info_failed');
    }

    const userInfo = await userInfoResponse.json();
    const { sub, email, name } = userInfo;

    if (!sub || !email) {
      console.error('UserInfo is missing required fields (sub or email).');
      return handleRedirect('/signin?error=profile_incomplete');
    }

    const authId = `google-${sub}`;
    const cookieStore = await cookies();

    // 3. Set standard Junto auth session cookie
    const sessionPayload = { auth_id: authId, email, name: name || email.split('@')[0] };
    cookieStore.set('junto_auth_session', JSON.stringify(sessionPayload), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    // 4. Check if profile already exists in DB for this authId
    const userRes = await query('SELECT * FROM users WHERE auth_id = $1', [authId]);

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
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

      // Redirect back to original target
      return handleRedirect(cleanState);
    } else {
      // New user, redirect to onboarding with target state preserved
      cookieStore.delete('junto_user_id');
      cookieStore.set('junto_has_profile', 'false', {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });

      const onboardingUrl = `/onboarding?redirect=${encodeURIComponent(cleanState)}`;
      return handleRedirect(onboardingUrl);
    }
  } catch (err) {
    console.error('Exception during Google OAuth callback processing:', err);
    return handleRedirect('/signin?error=internal_auth_error');
  }
}
