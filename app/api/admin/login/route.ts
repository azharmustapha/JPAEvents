import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { authCookieOptions, projectFetch } from '@/lib/supabase/project-routing';
import { verifyAdminLogin, waitForLogin, type LoginResult } from '@/lib/auth/login';

function respond(result: LoginResult, status = 200) {
  return NextResponse.json(result, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin) {
    const publicHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
      || request.headers.get('host') || new URL(request.url).host;
    try {
      if (new URL(origin).host !== publicHost.toLowerCase()) return respond({ ok: false, reason: 'unavailable' }, 403);
    } catch { return respond({ ok: false, reason: 'unavailable' }, 403); }
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) return respond({ ok: false, reason: 'invalid_credentials' }, 400);
  let credentials;
  try { credentials = await request.json(); } catch { return respond({ ok: false, reason: 'invalid_credentials' }, 400); }
  if (!credentials || typeof credentials.email !== 'string' || typeof credentials.password !== 'string'
    || !credentials.email.trim() || credentials.email.length > 254 || !credentials.password || credentials.password.length > 1024) {
    return respond({ ok: false, reason: 'invalid_credentials' }, 400);
  }
  const config = getSupabaseConfig();
  if (!config) return respond({ ok: false, reason: 'unavailable' }, 503);
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
  const currentCookies = new Map(request.cookies.getAll().map(cookie => [cookie.name, cookie.value]));
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
  try {
    const client = createServerClient(config.url, config.key, {
      cookieOptions: authCookieOptions,
      global: { fetch: projectFetch(config.url, (input, init) => fetch(input, { ...init, signal: deadline })) },
      cookies: {
        getAll: () => [...currentCookies].map(([name, value]) => ({ name, value })),
        setAll(values) {
          for (const cookie of values) {
            currentCookies.set(cookie.name, cookie.value);
            pendingCookies.set(cookie.name, cookie);
          }
        },
      },
    });
    const result = await waitForLogin(verifyAdminLogin(client, credentials.email, credentials.password), deadline);
    if (!result.ok) {
      const status = result.reason === 'timeout' ? 504 : result.reason === 'rate_limited' ? 429
        : result.reason === 'denied' ? 403 : result.reason === 'invalid_credentials' || result.reason === 'email_not_confirmed' ? 401 : 503;
      return respond(result, status);
    }
    const response = respond(result);
    // Publish cookies only after password authentication and admin membership succeed.
    for (const { name, value, options } of pendingCookies.values()) response.cookies.set(name, value, options);
    return response;
  } catch {
    return respond({ ok: false, reason: deadline.aborted ? 'timeout' : 'unavailable' }, 503);
  }
}
