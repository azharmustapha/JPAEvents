import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseConfig } from './config';
import { authCookieOptions, projectFetch } from './project-routing';

export async function createServerSupabase(signal?: AbortSignal) {
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    global: { fetch: projectFetch(url, (input, init) => fetch(input, { ...init, ...(signal ? { signal } : {}) })) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy handles session refresh.
        }
      },
    },
  });
}
