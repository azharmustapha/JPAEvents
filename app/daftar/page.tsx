'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CalendarDays, MapPin } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import type { Acara } from '@/types/database';
import { findRegistrationSession } from '@/lib/assembly';
import { isPassportToken, forgetMissingPassport } from '@/lib/attendance';
import { RegistrationForm } from '@/components/registration-form';
import { formatDate, formatTime } from '@/lib/date';
import { EventTheme } from '@/components/event-theme';

function DaftarContent() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('sesi');
  const [session, setSession] = useState<Acara | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setFetching(true);
        setSession(null);
        setError('');
        const data = await findRegistrationSession(getBrowserSupabase(), code);
        if (cancelled) return;
        if (!data) setError('Sesi perhimpunan tidak dijumpai atau telah ditutup.');
        else {
          setSession(data);
          try {
            const token = localStorage.getItem(`jpaevents_pasport_${data.kod_sesi}`);
            if (token && isPassportToken(token)) {
              const passport = await getBrowserSupabase().rpc('get_passport', { passport_token: token });
              if (cancelled) return;
              if (!passport.error && passport.data?.token_pasport === token && passport.data?.perhimpunan?.kod_sesi === data.kod_sesi) {
                router.replace(`/pasport/${encodeURIComponent(token)}`);
              } else if (forgetMissingPassport(localStorage, token, passport)) {
                window.dispatchEvent(new Event('storage'));
              }
            }
          } catch { /* Registration remains available when storage is disabled. */ }
        }
      } catch {
        if (!cancelled) setError('Gagal menyambung ke pangkalan data.');
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [code, router]);

  return <main className="mx-auto max-w-lg px-4 py-10 sm:py-14">
    <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#003053]">{session?.tajuk || 'Pendaftaran Kehadiran'}</h1>
    {session && <div className="mb-7 space-y-2 text-sm text-slate-600">
      <EventTheme tema={session.tema} />
      <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" />{formatDate(session.tarikh)} · {formatTime(session.masa_mula)}</p>
      <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" />{session.lokasi}</p>
    </div>}
    <RegistrationForm key={code || 'active'} session={session} fetching={fetching} sessionError={error} />
  </main>;
}

export default function DaftarPage() {
  return <Suspense fallback={<div className="flex min-h-80 items-center justify-center gap-3 text-slate-600" role="status"><Loader2 className="h-6 w-6 animate-spin" />Memuatkan sesi...</div>}><DaftarContent /></Suspense>;
}
