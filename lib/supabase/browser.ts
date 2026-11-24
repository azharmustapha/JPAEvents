import { createBrowserClient } from '@supabase/ssr';
import { requireSupabaseConfig } from './config';
import { authCookieOptions, projectFetch } from './project-routing';

export function getBrowserSupabase() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient(url, key, { cookieOptions: authCookieOptions, global: { fetch: projectFetch(url) } });
}
