'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowBackIcon, ExpandIcon, ZoomOutIcon, CalendarIcon, PinIcon, QrCodeIcon, UserGroupIcon, ReloadIcon, LockIcon, WarningCircleIcon, ArrowForwardIcon } from '@govtechmy/myds-react/icon';
import { loadPublishedSnapshot } from '@/lib/public-event-data';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { startPolling } from '@/lib/polling';
import { safeEventAsset } from '@/lib/event-assets';
import { eventPath } from '@/lib/events';
import { organizerColors } from '@/lib/organizer-navigation';
import { projectorCount, projectorRegistrationState } from '@/lib/projector';
import { formatDate } from '@/lib/date';
import type { Acara } from '@/types/database';
import styles from './event-projector.module.css';

const subscribeOrigin = () => () => {};

export function EventProjector({ event: initial }: { event: Acara }) {
  const [snapshot, setSnapshot] = useState<{ event: Acara | null; count: number | null }>({ event: initial, count: null });
  const [connected, setConnected] = useState(true);
  const [controlError, setControlError] = useState('');
  const [clock, setClock] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const screen = useRef<HTMLElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const wasPresenting = useRef(false);
  const origin = useSyncExternalStore(subscribeOrigin, () => window.location.origin, () => '');
  useEffect(() => startPolling(() => loadPublishedSnapshot(getBrowserSupabase(), initial.id), data => {
    setSnapshot(data); setConnected(true);
  }, () => setConnected(false)), [initial.id]);
  const event = snapshot.event;
  useEffect(() => {
    const tick = () => {
      try { setClock(new Intl.DateTimeFormat('ms-MY', { timeZone: event?.timezone || 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())); }
      catch { setClock(new Intl.DateTimeFormat('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())); }
    };
    void Promise.resolve().then(tick);
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [event?.timezone]);
  useEffect(() => {
    const change = () => setIsFullscreen(document.fullscreenElement === screen.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => {
    if (!presentationMode) return;
    const exit = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresentationMode(false); };
    document.addEventListener('keydown', exit);
    return () => document.removeEventListener('keydown', exit);
  }, [presentationMode]);
  useEffect(() => {
    const presenting = presentationMode || isFullscreen;
    if (presenting) exitButton.current?.focus();
    else if (wasPresenting.current) fullscreenButton.current?.focus();
    wasPresenting.current = presenting;
  }, [presentationMode, isFullscreen]);
  async function fullscreen() {
    setControlError('');
    try {
      if (presentationMode) { setPresentationMode(false); return; }
      if (document.fullscreenElement === screen.current) await document.exitFullscreen();
      else if (screen.current?.requestFullscreen) await screen.current.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch { setPresentationMode(true); }
  }

  const colors = organizerColors(event);
  const theme = { '--projection-primary': colors.primary, '--projection-accent': colors.accent, '--projection-foreground': colors.foreground } as CSSProperties;
  if (!event) return <main className={styles.page} style={theme}><div className={styles.unavailable}><CalendarIcon aria-hidden="true" /><h1>Tayangan tidak tersedia</h1><p>Acara ini tidak lagi diterbitkan. Sila kembali ke halaman utama.</p><Link href="/">Kembali ke JPAEvents<ArrowForwardIcon aria-hidden="true" /></Link></div></main>;

  const logo = safeEventAsset(event.logo_url), banner = safeEventAsset(event.banner_url);
  const registrationPath = event.slug ? eventPath(event.slug, 'daftar') : null;
  const registrationUrl = origin && registrationPath ? `${origin}${registrationPath}` : null;
  const registration = projectorRegistrationState({ available: true, verified: snapshot.count !== null, connected, registrationOpen: event.status_aktif, hasUrl: Boolean(registrationUrl) });
  const count = projectorCount(snapshot.count);

  return <main className={styles.page} style={theme}>
    <div className={styles.toolbar} inert={presentationMode || isFullscreen}><Link href={eventPath(event.slug || '')}><ArrowBackIcon aria-hidden="true" />Kembali ke acara</Link><span className={styles.toolbarLabel}>Tayangan acara</span><button ref={fullscreenButton} type="button" onClick={() => void fullscreen()}><ExpandIcon aria-hidden="true" />Skrin penuh</button></div>
    {controlError && <p role="alert" className={styles.controlError}>{controlError}</p>}
    <section ref={screen} className={`${styles.stage}${presentationMode ? ` ${styles.presentationMode}` : ''}`} role={presentationMode ? 'dialog' : undefined} aria-modal={presentationMode || undefined} aria-label={`Tayangan ${event.tajuk}`} onKeyDown={e => {
      if (!presentationMode || e.key !== 'Tab') return;
      const controls = screen.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }}>
      {(isFullscreen || presentationMode) && <button ref={exitButton} type="button" className={styles.exitFullscreen} onClick={() => void fullscreen()} aria-label={presentationMode ? 'Keluar mod tayangan' : 'Keluar skrin penuh'} title="Keluar tayangan (Esc)"><ZoomOutIcon aria-hidden="true" /></button>}
      <header className={styles.heading}><div className={styles.identity}>{logo && <div className={styles.logo}><img src={logo} alt={`Logo ${event.organizer_name || event.tajuk}`} /></div>}<div>{event.organizer_name && <p className={styles.organizer}>{event.organizer_name}</p>}<h1>{event.tajuk}</h1>{event.tema && <p className={styles.theme}>{event.tema}</p>}</div></div><div className={styles.details}><span><CalendarIcon aria-hidden="true" />{formatDate(event.tarikh, event.timezone)}</span><span><PinIcon aria-hidden="true" />{event.lokasi}</span></div></header>
      <div className={styles.layout}>
        <div className={styles.visualColumn}>
          <div className={`${styles.artwork}${banner ? '' : ` ${styles.textArtwork}`}`}>{banner ? <img src={banner} alt={`Banner ${event.tajuk}`} /> : <div><span className={styles.welcomeLabel}>Selamat datang</span><h2>{event.tema || 'Terima kasih kerana bersama kami.'}</h2>{event.description && <p>{event.description}</p>}</div>}</div>
          <div className={styles.welcome}><div><h2>Selamat datang.</h2><p>{registration === 'open' ? 'Imbas kod QR untuk mendaftar dan mendapatkan pas digital anda.' : 'Terima kasih atas penyertaan anda dalam acara ini.'}</p></div><div className={styles.clock}><time>{clock || '—'}</time><span>{event.timezone || 'Asia/Kuala_Lumpur'}</span></div></div>
        </div>
        <aside className={styles.registration} aria-label="Pendaftaran dan jumlah peserta">
          <div className={`${styles.status}${registration === 'open' ? ` ${styles.statusOpen}` : ''}`}><span />{registration === 'open' ? 'Pendaftaran dibuka' : registration === 'closed' ? 'Pendaftaran ditutup' : registration === 'offline' ? 'Menyambung semula' : registration === 'loading' ? 'Menyemak pendaftaran' : 'Pendaftaran tidak tersedia'}</div>
          {registration === 'open' && registrationUrl ? <><h2>Imbas untuk mendaftar</h2><Link href={registrationPath!} className={styles.qr} aria-label="Buka pendaftaran"><QRCodeSVG value={registrationUrl} size={420} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" title={`Pendaftaran ${event.tajuk}`} /></Link><p className={styles.scanHint}>Imbas atau tekan kod QR untuk mendaftar.</p></> : <div className={styles.registrationState} role="status">{registration === 'offline' ? <WarningCircleIcon aria-hidden="true" /> : registration === 'loading' ? <ReloadIcon aria-hidden="true" className={styles.spinning} /> : registration === 'closed' ? <LockIcon aria-hidden="true" /> : <QrCodeIcon aria-hidden="true" />}<h2>{registration === 'offline' ? 'Sambungan terganggu' : registration === 'loading' ? 'Sila tunggu sebentar' : registration === 'closed' ? 'Pendaftaran telah ditutup' : 'Pautan belum tersedia'}</h2><p>{registration === 'offline' ? 'Kami sedang menyambung semula. Kod QR akan dipaparkan apabila maklumat acara disahkan.' : registration === 'loading' ? 'Maklumat pendaftaran sedang disahkan.' : registration === 'closed' ? 'Peserta yang telah mendaftar boleh menggunakan pas digital masing-masing.' : 'Hubungi penganjur untuk maklumat pendaftaran.'}</p></div>}
          <div className={styles.attendance}><div><UserGroupIcon aria-hidden="true" /><span>Peserta berdaftar</span></div><strong aria-live="polite" data-long={count.length > 7}>{count}</strong><p>{!connected ? 'Jumlah terakhir sebelum sambungan terganggu' : snapshot.count === null ? 'Memuatkan jumlah peserta…' : 'Dikemas kini setiap 10 saat'}</p></div>
        </aside>
      </div>
      <footer className={styles.stageFooter}><span>{event.organizer_name || 'JPAEvents'}</span><span>{event.kod_sesi}</span></footer>
    </section>
  </main>;
}
