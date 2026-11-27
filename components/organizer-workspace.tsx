'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon, ClockIcon, PinIcon, LinkDiagonalIcon, PlusIcon } from '@govtechmy/myds-react/icon';
import { useOrganizer } from './organizer-provider';
import { safeEventAsset } from '@/lib/event-assets';
import { organizerColors, organizerHref } from '@/lib/organizer-navigation';
import { eventPath } from '@/lib/events';
import { formatDate, formatTime } from '@/lib/date';

export function OrganizerWorkspace({ children }: { children: ReactNode }) {
  const { event, events, loading, error, selectEvent, pathname, explicitId } = useOrganizer();
  const { primary, accent, foreground } = organizerColors(event);
  const banner = safeEventAsset(event?.banner_url), logo = safeEventAsset(event?.logo_url);
  const creating = pathname === '/admin/sesi-baru';
  const router = useRouter();
  useEffect(() => {
    // Pin the first default choice before polling or closing registration can
    // change which event would otherwise be considered the default.
    if (event && explicitId === null && !creating) router.replace(organizerHref(pathname, event.id), { scroll: false });
  }, [event, explicitId, creating, pathname, router]);
  const style = { '--event-primary': primary, '--event-accent': accent, '--event-foreground': foreground } as CSSProperties;
  return <div className="organizer-workspace" style={style}>
    <div className="workspace-heading">
      <div><p className="workspace-eyebrow">Ruang penganjur</p><h1>{creating ? 'Acara baharu' : event?.organizer_name || 'Pengurusan acara'}</h1></div>
      <div className="workspace-switcher"><label htmlFor="workspace-event">Acara pilihan</label><div><select id="workspace-event" value={event?.id || ''} disabled={loading || !events.length} onChange={e => selectEvent(e.target.value)}>
        <option value="" disabled>{loading ? 'Memuatkan acara…' : events.length ? 'Pilih acara' : 'Belum ada acara'}</option>
        {events.map(item => <option key={item.id} value={item.id}>{item.tajuk}</option>)}
      </select><Link href="/admin/sesi-baru" className="workspace-add" aria-label="Cipta acara baharu" title="Cipta acara baharu"><PlusIcon aria-hidden="true" className="size-5" /></Link></div></div>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!loading && explicitId !== null && !event && !error && <p role="alert" className="form-error">Acara tidak ditemui atau anda tidak mempunyai akses. Pilih acara lain untuk meneruskan.</p>}
    {loading && <div className="workspace-loading" role="status">Memuatkan identiti acara…</div>}
    {event && !creating && <section className={`workspace-event-card${banner ? ' has-banner' : ''}`} aria-label="Identiti acara pilihan">
      {banner && <div className="workspace-banner"><img src={banner} alt={`Banner ${event.tajuk}`} /></div>}
      <div className="workspace-event-info">
        <div className="workspace-event-title">{logo && <img src={logo} alt={`Logo ${event.organizer_name || event.tajuk}`} className="workspace-event-logo" />}<div><span className={`workspace-status${event.status_aktif ? ' is-open' : ''}`}>{!event.published ? 'Draf acara' : event.status_aktif ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}</span><h2>{event.tajuk}</h2></div></div>
        {event.tema && <p className="workspace-event-theme">{event.tema}</p>}
        {event.description && <p className="workspace-event-description">{event.description}</p>}
        <dl className="workspace-event-details"><div><dt><CalendarIcon aria-hidden="true" />Tarikh</dt><dd>{formatDate(event.tarikh, event.timezone)}</dd></div><div><dt><ClockIcon aria-hidden="true" />Masa mula</dt><dd>{formatTime(event.masa_mula, false, event.timezone)}<small>{event.timezone || 'Asia/Kuala_Lumpur'}</small></dd></div><div className="workspace-location"><dt><PinIcon aria-hidden="true" />Lokasi</dt><dd>{event.lokasi}</dd></div></dl>
        <div className="workspace-event-actions"><Link href={`/admin/events/${encodeURIComponent(event.id)}`} className="workspace-button">Butiran & identiti</Link>{event.published && event.slug && <Link href={eventPath(event.slug)} className="workspace-button secondary" target="_blank" rel="noopener noreferrer">Lihat halaman acara<LinkDiagonalIcon aria-hidden="true" className="size-4" /></Link>}</div>
      </div>
    </section>}
    {!loading && !error && !events.length && !creating && <section className="workspace-empty"><CalendarIcon aria-hidden="true" className="size-8" /><h2>Mulakan dengan acara pertama anda</h2><p>Daftarkan butiran acara, muat naik logo dan banner, kemudian kongsi pautan pendaftaran.</p><Link href="/admin/sesi-baru" className="workspace-button">Cipta acara</Link></section>}
    <div className="workspace-module" key={creating ? 'new-event' : event?.id || 'no-event'}>{children}</div>
  </div>;
}
