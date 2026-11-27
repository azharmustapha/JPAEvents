'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon } from '@govtechmy/myds-react/icon';
import { useOrganizer } from './organizer-provider';
import { safeEventAsset } from '@/lib/event-assets';
import { organizerColors, organizerHref } from '@/lib/organizer-navigation';

export function OrganizerWorkspace({ children }: { children: ReactNode }) {
  const { event, events, loading, error, selectEvent, pathname, explicitId } = useOrganizer();
  const catalog = pathname === '/admin';
  const creating = pathname === '/admin/sesi-baru';
  const contextual = !catalog && !creating;
  const { primary, accent, foreground } = organizerColors(contextual ? event : null);
  const logo = safeEventAsset(event?.logo_url);
  const router = useRouter();
  useEffect(() => {
    if (contextual && event && explicitId === null) router.replace(organizerHref(pathname, event.id), { scroll: false });
  }, [contextual, event, explicitId, pathname, router]);
  const style = { '--event-primary': primary, '--event-accent': accent, '--event-foreground': foreground } as CSSProperties;
  return <div className={`organizer-workspace${catalog ? ' catalog-workspace' : ''}`} style={style}>
    {contextual && <div className="module-context">
      <div className="module-context-event">{logo ? <img src={logo} alt="Logo acara" /> : <span className="module-context-icon"><CalendarIcon aria-hidden="true" /></span>}<div><span>Acara pilihan</span><strong>{loading ? 'Memuatkan acara…' : event?.tajuk || 'Pilih acara untuk meneruskan'}</strong></div></div>
      <div className="module-context-select"><label htmlFor="workspace-event">Tukar acara</label><select id="workspace-event" value={event?.id || ''} disabled={loading || !events.length} onChange={e => selectEvent(e.target.value)}>
        <option value="" disabled>{loading ? 'Memuatkan…' : 'Pilih acara'}</option>{events.map(item => <option key={item.id} value={item.id}>{item.tajuk}</option>)}
      </select></div>
    </div>}
    {!catalog && error && <p role="alert" className="form-error">{error}</p>}
    {contextual && !loading && explicitId !== null && !event && !error && <p role="alert" className="form-error">Acara tidak ditemui atau anda tidak mempunyai akses. Pilih acara lain atau <Link href="/admin">kembali ke Acara saya</Link>.</p>}
    {contextual && !loading && !error && !events.length && <p className="workspace-loading">Belum ada acara. <Link href="/admin/sesi-baru" className="underline">Cipta acara pertama anda</Link> untuk menggunakan modul ini.</p>}
    <div className="workspace-module" key={catalog ? 'catalog' : creating ? 'new-event' : event?.id || 'no-event'}>{children}</div>
  </div>;
}
