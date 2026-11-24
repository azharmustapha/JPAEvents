import type { SupabaseClient } from '@supabase/supabase-js';

export type LoginFailure = 'invalid_credentials' | 'email_not_confirmed' | 'rate_limited' | 'unavailable' | 'denied' | 'access_unavailable' | 'timeout';
export type LoginResult = { ok: true } | { ok: false; reason: LoginFailure };

export async function verifyAdminLogin(client: SupabaseClient, email: string, password: string): Promise<LoginResult> {
  let auth;
  try { auth = await client.auth.signInWithPassword({ email: email.trim(), password }); }
  catch { return { ok: false, reason: 'unavailable' }; }
  if (auth.error) {
    const { code, status } = auth.error;
    const reason = code === 'invalid_credentials' ? 'invalid_credentials'
      : code === 'email_not_confirmed' ? 'email_not_confirmed'
      : status === 429 || code === 'over_request_rate_limit' ? 'rate_limited' : 'unavailable';
    return { ok: false, reason };
  }
  const { user, session } = auth.data;
  if (!user || !session || session.user.id !== user.id) return { ok: false, reason: 'unavailable' };
  let reason: LoginFailure | null = null;
  try {
    const { data, error } = await client.from('workspace_members').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) reason = 'access_unavailable';
    else if (data && data.user_id !== user.id) reason = 'denied';
  } catch { reason = 'access_unavailable'; }
  if (!reason) return { ok: true };
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* Failed responses never commit session cookies. */ }
  return { ok: false, reason };
}

export async function waitForLogin(operation: Promise<LoginResult>, signal: AbortSignal): Promise<LoginResult> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (result: LoginResult) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      resolve(result);
    };
    const abort = () => finish({ ok: false, reason: 'timeout' });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    operation.then(finish, () => finish({ ok: false, reason: 'unavailable' }));
  });
}

export function getLoginMessage(reason: string | null): string {
  switch (reason) {
    case 'invalid_credentials': return 'E-mel atau kata laluan tidak sah. Semak maklumat dan cuba lagi.';
    case 'email_not_confirmed': return 'E-mel akaun belum disahkan. Semak e-mel pengesahan atau hubungi urus setia.';
    case 'rate_limited': return 'Terlalu banyak cubaan log masuk. Tunggu sebentar sebelum mencuba lagi.';
    case 'denied': return 'Akaun ini belum diberi akses penganjur. Hubungi urus setia untuk semakan akses.';
    case 'access_unavailable': return 'Semakan akses penganjur gagal. Sila cuba lagi sebentar.';
    case 'timeout': return 'Sambungan mengambil terlalu lama. Semak internet anda dan cuba lagi.';
    default: return 'Perkhidmatan log masuk tidak dapat dihubungi. Semak sambungan dan cuba lagi.';
  }
}
