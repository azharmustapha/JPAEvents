'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { loadAdminSessions } from '@/lib/admin-data';
import { startPolling } from '@/lib/polling';
import { organizerDisplayName, organizerHref, resolveOrganizerEvent } from '@/lib/organizer-navigation';
import type { Acara } from '@/types/database';

type OrganizerState = {
  userId: string | null; displayName: string; authLoading: boolean; events: Acara[]; loading: boolean; error: string;
  refreshEvents: () => Promise<void>;
};
const OrganizerContext = createContext<OrganizerState | null>(null);
const subscribeHydration = () => () => {};

export function OrganizerProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Akaun saya');
  const [authLoading, setAuthLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<{ owner: string | null; events: Acara[]; error: string }>({ owner: null, events: [], error: '' });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void Promise.resolve().then(() => {
      if (!active) return;
      const client = getBrowserSupabase();
      // Auth callbacks stay synchronous: data loading happens in the separate effect.
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (active) { setUserId(session?.user.id ?? null); setDisplayName(organizerDisplayName(session?.user ?? null)); setAuthLoading(false); }
      });
      unsubscribe = () => subscription.unsubscribe();
    }).catch(() => { if (active) setAuthLoading(false); });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    return startPolling(() => loadAdminSessions(getBrowserSupabase()), events => {
      setSnapshot({ owner: userId, events, error: '' });
    }, () => setSnapshot({ owner: userId, events: [], error: 'Acara tidak dapat dimuatkan. Semak sambungan dan cuba lagi.' }));
  }, [userId]);

  const current = snapshot.owner === userId && userId !== null;
  async function refreshEvents() {
    if (!userId) return;
    const events = await loadAdminSessions(getBrowserSupabase());
    setSnapshot({ owner: userId, events, error: '' });
  }
  return <OrganizerContext.Provider value={{ userId, displayName, authLoading, events: current ? snapshot.events : [], loading: authLoading || Boolean(userId && !current), error: current ? snapshot.error : '', refreshEvents }}>{children}</OrganizerContext.Provider>;
}

export function useOrganizer() {
  const context = useContext(OrganizerContext);
  if (!context) throw new Error('OrganizerProvider is required');
  // A streamed Suspense child may hydrate after Auth has already emitted.
  // Give each consumer the same initial snapshot as its server HTML.
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const visible = hydrated ? context : { ...context, userId: null, displayName: 'Akaun saya', authLoading: true, events: [], loading: true, error: '' };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editorId = /^\/admin\/events\/([^/]+)$/.exec(pathname)?.[1];
  const publicSlug = /^\/events\/([^/]+)/.exec(pathname)?.[1];
  const publicEvent = publicSlug ? visible.events.find(item => item.slug === decodeURIComponent(publicSlug)) : null;
  const explicitId = editorId ? decodeURIComponent(editorId) : publicEvent?.id ?? searchParams.get('event');
  // Every module link includes the selection; browser Back/Forward restores it too.
  const event = resolveOrganizerEvent(visible.events, explicitId, null);
  function selectEvent(id: string) {
    const target = pathname === '/admin/sesi-baru' ? '/admin' : pathname;
    router.push(editorId ? `/admin/events/${encodeURIComponent(id)}` : organizerHref(target, id), { scroll: false });
  }
  return { ...visible, event, selectEvent, pathname, explicitId };
}
