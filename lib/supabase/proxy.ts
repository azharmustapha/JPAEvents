import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';
import { authCookieOptions } from './project-routing';
import { withAuthTimeout } from '../auth/timeout';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  // The public login form must remain reachable even while Auth is unavailable.
  if (request.nextUrl.pathname === '/admin/login') return response;
  const config = getSupabaseConfig();
  if (!config) return response;
  let claims = false;
  let unavailable = false;
  try {
    const auth = await withAuthTimeout(async signal => {
      const client = createServerClient(config.url, config.key, {
        cookieOptions: authCookieOptions,
        global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values, headers) {
            values.forEach(({ name, value }) => request.cookies.set(name, value));
            const previousCookies = response.cookies.getAll();
            const previousHeaders = new Headers(response.headers);
            response = NextResponse.next({ request });
            previousCookies.forEach(cookie => response.cookies.set(cookie));
            previousHeaders.forEach((value, name) => response.headers.set(name, value));
            values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
          },
        },
      });
      return client.auth.getClaims();
    });
    claims = Boolean(auth.data?.claims);
    unavailable = Boolean(auth.error && auth.error.name !== 'AuthSessionMissingError' && (!auth.error.status || auth.error.status >= 500));
  } catch { unavailable = true; }
  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    if (unavailable) {
      url.searchParams.set('error', 'unavailable');
    }
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    for (const name of ['cache-control', 'expires', 'pragma']) {
      const value = response.headers.get(name);
      if (value) redirected.headers.set(name, value);
    }
    return redirected;
  }
  return response;
}
