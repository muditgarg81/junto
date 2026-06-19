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

  const handleRedirect = (destination: string, token?: string) => {
    if (isNative) {
      let juntofunUrl = `juntofun://callback?redirect=${encodeURIComponent(destination)}`;
      if (token) {
        juntofunUrl += `&token=${encodeURIComponent(token)}`;
      }
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Junto...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #fff9ed;
      color: #1f4d3f;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
      text-align: center;
    }
    .container {
      max-width: 400px;
      width: 100%;
      padding: 40px 24px;
      background: #faf6f1;
      border: 1px solid #e2ded8;
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
    }
    h1 {
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 16px;
      color: #1f4d3f;
    }
    p {
      font-size: 16px;
      color: #6d6c68;
      margin-bottom: 32px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background-color: #1f4d3f;
      color: #fff9ed;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(31, 77, 63, 0.25);
      transition: background-color 0.2s;
    }
    .btn:active {
      background-color: #15342a;
    }
    .loader {
      border: 3px solid #e2ded8;
      border-top: 3px solid #1f4d3f;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="loader"></div>
    <h1>Connecting to Junto...</h1>
    <p>You have signed in successfully. We are redirecting you back to the app.</p>
    <a href="${juntofunUrl}" class="btn">Return to Junto</a>
  </div>
  <script>
    const redirectUrl = "${juntofunUrl}";
    // Attempt automatic redirect immediately
    window.location.href = redirectUrl;
    // Fallback automatic redirect after 500ms
    setTimeout(function() {
      window.location.href = redirectUrl;
    }, 500);
  </script>
</body>
</html>`;
      return new Response(htmlContent, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
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
      secure: !isLocal,
      sameSite: 'lax',
    });

    // 4. Check if profile already exists in DB for this authId
    let userRes = await query('SELECT * FROM users WHERE auth_id = $1', [authId]);
    let user = userRes.rows.length > 0 ? userRes.rows[0] : null;

    if (!user) {
      // 5. Check if user already exists by email (case-insensitive linking)
      const emailUserRes = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (emailUserRes.rows.length > 0) {
        user = emailUserRes.rows[0];
        // Link Google authId to this existing email account and update name/photo if missing
        const updateRes = await query(
          `UPDATE users
           SET auth_id = $1,
               name = COALESCE(name, $2),
               photo_url = COALESCE(photo_url, $3)
           WHERE id = $4
           RETURNING *`,
          [authId, name || email.split('@')[0], userInfo.picture || null, user.id]
        );
        user = updateRes.rows[0];
        console.log(`Successfully linked Google account to existing user: ${email}`);
      } else {
        // 6. Automatically register/create a new user profile using Google details
        const id = crypto.randomUUID();
        const insertRes = await query(
          `INSERT INTO users (id, auth_id, name, email, photo_url, home_currency)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            id,
            authId,
            name || email.split('@')[0],
            email.trim().toLowerCase(),
            userInfo.picture || null,
            'INR'
          ]
        );
        user = insertRes.rows[0];
        console.log(`Successfully auto-registered new Google user: ${email}`);
      }
    }

    const signedToken = signSessionToken(user.id);

    cookieStore.set('junto_user_id', signedToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
    });
    cookieStore.set('junto_has_profile', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
    });
    cookieStore.set('junto_show_packing_reminder', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
      secure: !isLocal,
      sameSite: 'lax',
    });

    // Redirect back to original target (no onboarding screen!)
    return handleRedirect(cleanState, signedToken);
  } catch (err) {
    console.error('Exception during Google OAuth callback processing:', err);
    return handleRedirect('/signin?error=internal_auth_error');
  }
}
