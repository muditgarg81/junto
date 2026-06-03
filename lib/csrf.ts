'use strict';

import { NextRequest } from 'next/server';

/**
 * Validates Origin and Sec-Fetch-Site headers on incoming request
 * to protect mutating endpoints from CSRF attacks.
 */
export function verifyCsrf(req: NextRequest): boolean {
  // Safe methods (GET, HEAD, OPTIONS) do not require CSRF checks
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  const secFetchSite = req.headers.get('sec-fetch-site');

  // 1. Enforce same-origin via Sec-Fetch-Site if provided by browser
  if (secFetchSite && secFetchSite !== 'same-origin') {
    console.warn(`CSRF Blocked: Sec-Fetch-Site is "${secFetchSite}", expected "same-origin"`);
    return false;
  }

  // 2. Validate Origin matches the server's Host header
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHost = host || req.nextUrl.host;
      if (originUrl.host !== expectedHost) {
        console.warn(`CSRF Blocked: Origin host "${originUrl.host}" does not match server host "${expectedHost}"`);
        return false;
      }
    } catch (e) {
      console.warn('CSRF Blocked: Malformed Origin header', origin);
      return false;
    }
  }

  return true;
}
