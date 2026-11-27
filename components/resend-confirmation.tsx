'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { authOrigin } from '@/lib/auth/urls';

export function ResendConfirmation({ initialEmail = '' }: { initialEmail?: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setBusy(true); setError(''); setSent(false);
    try {
      const { error } = await getBrowserSupabase().auth.resend({
        type: 'signup', email,
        options: { emailRedirectTo: new URL('/auth/confirm', authOrigin(window.location.origin)).href },
      });
      if (error) {
        setError(error.status === 429 ? 'Terlalu banyak permintaan. Tunggu sebentar sebelum meminta pautan baharu.' : 'E-mel belum dapat dihantar. Semak sambungan dan cuba lagi.');
        return;
      }
      setSent(true); setCooldown(60);
    } catch { setError('E-mel belum dapat dihantar. Semak sambungan dan cuba lagi.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="editor-panel" aria-busy={busy}>
    <h2>Perlukan pautan pengesahan baharu?</h2>
    <p>Gunakan alamat e-mel yang sama seperti semasa mendaftar akaun penganjur.</p>
    <label>E-mel penganjur<input name="email" type="email" autoComplete="email" defaultValue={initialEmail} onChange={() => setSent(false)} required maxLength={254} disabled={busy} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    {sent && <p role="status">Jika akaun ini masih memerlukan pengesahan, pautan baharu akan dihantar. Semak peti masuk dan folder spam. Gunakan e-mel yang paling baharu.</p>}
    <button type="submit" className="primary-action" disabled={busy || cooldown > 0}>{busy ? 'Menghantar…' : cooldown > 0 ? `Hantar semula dalam ${cooldown}s` : 'Hantar semula e-mel pengesahan'}</button>
  </form>;
}
