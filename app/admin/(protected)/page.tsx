'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { CalendarIcon, ClockIcon, PinIcon, PlusIcon, SearchIcon, CrossIcon, ArrowForwardIcon, UserGroupIcon, DesktopIcon } from '@govtechmy/myds-react/icon';
import { useOrganizer } from '@/components/organizer-provider';
import { filterEventCatalog, type CatalogStatus } from '@/lib/event-catalog';
import { organizerColors, organizerHref } from '@/lib/organizer-navigation';
import { safeEventAsset } from '@/lib/event-assets';
import { eventPath } from '@/lib/events';
import { formatDate, formatTime } from '@/lib/date';

const filters: { value: CatalogStatus; label: string }[] = [
  { value: 'all', label: 'Semua acara' }, { value: 'open', label: 'Pendaftaran dibuka' },
  { value: 'published', label: 'Diterbitkan' }, { value: 'draft', label: 'Draf' },
];

export default function MyEventsPage() {
  const { events, loading, error, refreshEvents } = useOrganizer();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CatalogStatus>('all');
  const [retrying, setRetrying] = useState(false);
  const visible = filterEventCatalog(events, query, status);
  const openCount = events.filter(event => event.published && event.status_aktif).length;
  const draftCount = events.filter(event => !event.published).length;
  async function retry() { setRetrying(true); try { await refreshEvents(); } catch { /* The provider displays connection failures. */ } finally { setRetrying(false); } }

  return <main className="event-catalog">
    <header className="catalog-heading"><div><p className="catalog-intro">Ruang untuk setiap acara anda</p><h1>Acara saya</h1><p>Daripada idea pertama hingga hari acara. Semuanya bermula di sini.</p></div><Link href="/admin/sesi-baru" className="workspace-button catalog-create"><PlusIcon aria-hidden="true" />Cipta acara</Link></header>
    {!loading && !error && events.length > 0 && <div className="catalog-overview" aria-label="Ringkasan acara"><p><strong>{events.length}</strong> acara dalam ruang anda</p><span /><p><strong>{openCount}</strong> pendaftaran dibuka</p><span /><p><strong>{draftCount}</strong> draf untuk dilengkapkan</p></div>}
    {(events.length > 0 || query || status !== 'all') && !error && <div className="catalog-toolbar"><div className="catalog-filters" role="group" aria-label="Tapis status acara">{filters.map(filter => <button key={filter.value} type="button" aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>)}</div><div className="catalog-search"><SearchIcon aria-hidden="true" /><label htmlFor="event-search" className="sr-only">Cari acara</label><input id="event-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau lokasi acara…" />{query && <button type="button" aria-label="Kosongkan carian" onClick={() => setQuery('')}><CrossIcon aria-hidden="true" /></button>}</div></div>}
    {error ? <section className="catalog-empty" role="alert"><CalendarIcon aria-hidden="true" /><h2>Acara belum dapat dimuatkan</h2><p>{error}</p><button type="button" disabled={retrying} onClick={() => void retry()} className="workspace-button">{retrying ? 'Mencuba semula…' : 'Cuba lagi'}</button></section> : loading ? <div className="catalog-loading" role="status"><span />Memuatkan acara anda…</div> : !events.length ? <section className="catalog-empty"><div className="catalog-empty-art"><CalendarIcon aria-hidden="true" /></div><h2>Acara pertama anda bermula di sini</h2><p>Bengkel, majlis, persidangan atau hari keluarga. Sediakan butirannya dan jadikan ia milik anda.</p><Link href="/admin/sesi-baru" className="workspace-button"><PlusIcon aria-hidden="true" />Cipta acara pertama</Link></section> : !visible.length ? <section className="catalog-empty"><SearchIcon aria-hidden="true" /><h2>Tiada acara yang sepadan</h2><p>Cuba kata carian lain atau lihat semula semua acara anda.</p><button type="button" className="workspace-button secondary" onClick={() => { setQuery(''); setStatus('all'); }}>Lihat semua acara</button></section> : <>
      <p role="status" className="catalog-result">{visible.length} {visible.length === events.length ? 'acara' : `daripada ${events.length} acara`}</p>
      <div className="catalog-grid">{visible.map(event => {
        const banner = safeEventAsset(event.banner_url), logo = safeEventAsset(event.logo_url);
        const colors = organizerColors(event);
        const style = { '--card-primary': colors.primary, '--card-accent': colors.accent, '--card-foreground': colors.foreground } as CSSProperties;
        const statusText = !event.published ? 'Draf' : event.status_aktif ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup';
        return <article key={event.id} className="catalog-card" style={style}>
          <Link href={`/admin/events/${encodeURIComponent(event.id)}`} className={`catalog-art${banner ? '' : ' without-banner'}`} aria-label={`Urus acara ${event.tajuk}`} tabIndex={-1}>
            {banner ? <img src={banner} alt={`Banner ${event.tajuk}`} /> : <div className="catalog-art-placeholder"><CalendarIcon aria-hidden="true" /><span>{event.tema || event.organizer_name || 'Acara anda, identiti anda.'}</span></div>}
          </Link>
          <div className="catalog-card-body"><div className="catalog-card-top"><span className={`catalog-event-status ${!event.published ? 'is-draft' : event.status_aktif ? 'is-open' : ''}`}>{statusText}</span>{logo && <img src={logo} alt={`Logo ${event.organizer_name || event.tajuk}`} className="catalog-event-logo" />}</div>
            {event.organizer_name && <p className="catalog-organizer">{event.organizer_name}</p>}<h2><Link href={`/admin/events/${encodeURIComponent(event.id)}`}>{event.tajuk}</Link></h2>
            <dl className="catalog-card-details"><div><dt><CalendarIcon aria-hidden="true" /><span className="sr-only">Tarikh</span></dt><dd>{formatDate(event.tarikh, event.timezone)}<ClockIcon aria-hidden="true" />{formatTime(event.masa_mula, false, event.timezone)}</dd></div><div><dt><PinIcon aria-hidden="true" /><span className="sr-only">Lokasi</span></dt><dd>{event.lokasi}</dd></div></dl>
            <div className="catalog-card-actions"><Link href={`/admin/events/${encodeURIComponent(event.id)}`} className="catalog-manage" aria-label={`Urus acara ${event.tajuk}`}>Urus acara<ArrowForwardIcon aria-hidden="true" /></Link><Link href={organizerHref('/admin/kehadiran', event.id)} className="catalog-attendance" aria-label={`Kehadiran ${event.tajuk}`}><UserGroupIcon aria-hidden="true" />Kehadiran</Link></div>
            {event.published && event.slug ? <Link href={eventPath(event.slug, 'tayangan')} target="_blank" rel="noopener noreferrer" className="catalog-projector" aria-label={`Buka tayangan ${event.tajuk} dalam tab baharu`}><DesktopIcon aria-hidden="true" />Tayangan</Link> : <span className="catalog-projector is-disabled" aria-disabled="true" title="Simpan dan terbitkan acara untuk membuka tayangan"><DesktopIcon aria-hidden="true" />Tayangan<small>Terbitkan acara dahulu</small></span>}
          </div>
        </article>;
      })}</div>
    </>}
  </main>;
}
