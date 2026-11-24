'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getLoginMessage, type LoginResult } from '@/lib/auth/login';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [dismissedRedirect, setDismissedRedirect] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const reason = failure || (!dismissedRedirect ? searchParams.get('error') : null);

  useEffect(() => () => {
    const controller = requestRef.current;
    requestRef.current = null;
    controller?.abort();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    // Password managers can fill inputs without updating React state.
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') || '').trim();
    const password = String(fields.get('password') || '');
    const controller = new AbortController();
    requestRef.current = controller;
    setFailure(null);
    setDismissedRedirect(true);
    setLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let authenticated = false;
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }),
      });
      const result: LoginResult = await response.json();
      if (requestRef.current !== controller) return;
      if (!response.ok || result.ok !== true) {
        setFailure(result.ok === false ? result.reason : 'unavailable');
        return;
      }
      authenticated = true;
      // A fresh request uses the server-set cookies and avoids stale prefetched admin pages.
      window.location.replace('/admin');
    } catch {
      if (requestRef.current === controller) setFailure(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller && !authenticated) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:py-16">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#003053]">Log masuk penganjur</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">Urus acara, tema dan peserta anda menggunakan akaun penganjur.</p>
      </header>
      <div className="boarding-pass-card p-6 sm:p-8">
        {reason && <div id="login-error" role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{getLoginMessage(reason)}</p>
        </div>}
        <form onSubmit={handleLogin} aria-busy={loading}>
          <fieldset disabled={loading} className="min-w-0 space-y-5">
            <legend className="sr-only">Maklumat akaun penganjur</legend>
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold text-[#003053]">E-mel penganjur</label>
              <input id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                required maxLength={254} placeholder="nama@example.com"
                aria-invalid={reason === 'invalid_credentials'} aria-describedby={reason ? 'login-error' : undefined} className="registration-input" />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-[#003053]">Kata laluan</label>
              <div className="relative">
                <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  required maxLength={1024} placeholder="Masukkan kata laluan"
                  onKeyDown={event => setCapsLock(event.getModifierState('CapsLock'))} onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)} aria-invalid={reason === 'invalid_credentials'}
                  aria-describedby={capsLock ? 'password-caps-lock' : reason ? 'login-error' : undefined} className="registration-input pr-12" />
                <button type="button" aria-label={showPassword ? 'Sembunyikan kata laluan' : 'Tunjukkan kata laluan'} aria-pressed={showPassword}
                  aria-controls="admin-password" onClick={() => setShowPassword(value => !value)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-600 hover:text-[#003053] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053]">
                  {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
              {capsLock && <p id="password-caps-lock" role="status" className="mt-2 text-xs text-amber-800">Caps Lock sedang aktif.</p>}
            </div>
          </fieldset>
          <button type="submit" disabled={loading} className="primary-action mt-6 w-full">
            {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {loading ? 'Sedang log masuk…' : 'Log masuk'}
          </button>
          {loading && <p role="status" className="mt-3 text-center text-sm text-slate-600">Mengesahkan akaun dan akses penganjur. Sila tunggu.</p>}
        </form>
        <details className="mt-6 border-t border-slate-200 pt-5 text-sm leading-relaxed text-slate-600">
          <summary className="cursor-pointer rounded-sm font-semibold text-[#003053] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053]">Masih tidak dapat log masuk?</summary>
          <p className="mt-3">Pastikan e-mel anda betul dan akaun telah disahkan melalui pautan e-mel. Selepas log masuk kali pertama, anda akan diminta menyediakan ruang penganjur anda.</p>
        </details>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-[#003053] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053]">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />Kembali ke halaman utama
        </Link>
        <span className="inline-flex items-center gap-1.5"><Lock aria-hidden="true" className="h-3.5 w-3.5" />Ruang penganjur</span>
      </div>
    <p className="mt-5 text-sm text-slate-600">Belum mempunyai akaun? <a href="/signup" className="font-semibold underline">Cipta akaun penganjur</a></p></main>
  );
}

export default function AdminLoginPage() {
  return <Suspense fallback={<p role="status" className="p-8 text-center">Memuatkan log masuk…</p>}><AdminLoginForm /></Suspense>;
}
