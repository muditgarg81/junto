import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Exclude static assets, api routes, public pages, and common asset paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/' ||        // Landing page is always public
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/disclaimer'
  ) {
    return NextResponse.next();
  }

  const authSession = request.cookies.get('junto_auth_session')?.value;
  const hasProfile = request.cookies.get('junto_has_profile')?.value === 'true';

  // 1. If NOT authenticated, redirect to /signin (except when already on /signin)
  if (!authSession) {
    if (pathname !== '/signin') {
      const redirectUrl = new URL(`/signin`, request.url);
      // Preserve current path in redirect query param
      redirectUrl.searchParams.set('redirect', pathname + search);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  // 2. If authenticated but has NO profile, redirect to /onboarding (except when already on /onboarding or /signin)
  if (!hasProfile) {
    if (pathname !== '/onboarding' && pathname !== '/signin') {
      const redirectUrl = new URL('/onboarding', request.url);
      if (search) {
        redirectUrl.search = search;
      } else {
        redirectUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  // 3. If authenticated AND has profile, do not allow /signin or /onboarding
  if (pathname === '/signin' || pathname === '/onboarding') {
    const redirectParam = request.nextUrl.searchParams.get('redirect') || '/';
    return NextResponse.redirect(new URL(redirectParam, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
