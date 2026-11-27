'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { CalendarIcon, ClockIcon, PinIcon, ArrowForwardIcon, ListIcon, DocumentIcon, CheckCircleIcon, CheckShieldIcon, ReloadIcon, LinkDiagonalIcon } from '@govtechmy/myds-react/icon';
import { EventProjector } from '@/components/event-projector';
import { RegistrationForm } from '@/components/registration-form';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { safeEventAsset } from '@/lib/event-assets';
import { eventPath } from '@/lib/events';
import { organizerColors } from '@/lib/organizer-navigation';
import { isPassportToken } from '@/lib/attendance';
import { formatDate, formatTime } from '@/lib/date';
import type { Acara, AturCara } from '@/types/database';
import styles from './public-event.module.css';

type EventSection = 'details' | 'daftar' | 'atur-cara' | 'tayangan';

export function PublicEvent({ event, section = 'details' }: { event: Acara; section?: EventSection }) {
  if (section === 'tayangan') return <EventProjector key={event.id} event={event} />;
  return <PublicEventContent key={`${event.id}:${section}`} event={event} section={section} />;
}

function PublicEventContent({ event, section }: { event: Acara; section: Exclude<EventSection, 'tayangan'> }) {
  const [agenda, setAgenda] = useState<AturCara[]>([]);
  const [agendaState, setAgendaState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [agendaAttempt, setAgendaAttempt] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [checkingPass, setCheckingPass] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function checkPass() {
      try {
        const saved = localStorage.getItem(`jpaevents_pasport_${event.kod_sesi}`);
        if (saved && isPassportToken(saved)) {
          const response = await Promise.race([
            getBrowserSupabase().rpc('get_passport', { passport_token: saved }).abortSignal(controller.signal),
            new Promise<null>(resolve => { timeout = setTimeout(() => { controller.abort(); resolve(null); }, 6000); }),
          ]);
          if (active && response && !response.error && response.data?.perhimpunan?.kod_sesi === event.kod_sesi) setToken(saved);
        }
      } catch { /* Registration remains available when browser storage is blocked. */ }
      finally { clearTimeout(timeout); if (active) setCheckingPass(false); }
    }
    void checkPass();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [event.kod_sesi]);
  useEffect(() => {
    if (section !== 'atur-cara') return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    void getBrowserSupabase().from('atur_cara').select('*').eq('perhimpunan_id', event.id).order('turutan', { ascending: true }).abortSignal(controller.signal).then(({ data, error }) => {
      clearTimeout(timeout);
      if (!active) return;
      if (error) setAgendaState('error');
      else { setAgenda(data as AturCara[]); setAgendaState('ready'); }
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [section, event.id, agendaAttempt]);

  const colors = organizerColors(event);
  const theme = { '--public-primary': colors.primary, '--public-accent': colors.accent, '--public-foreground': colors.foreground } as CSSProperties;
  const logo = safeEventAsset(event.logo_url), banner = safeEventAsset(event.banner_url), slug = event.slug || '';
  const registerUrl = eventPath(slug, 'daftar');
  const passUrl = token ? `/pasport/${encodeURIComponent(token)}` : null;
  const status = <span className={`${styles.status}${event.status_aktif ? ` ${styles.statusOpen}` : ''}`}><span />{event.status_aktif ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}</span>;
  const facts = <dl className={styles.facts}><div><dt><CalendarIcon aria-hidden="true" />Tarikh</dt><dd>{formatDate(event.tarikh, event.timezone)}</dd></div><div><dt><ClockIcon aria-hidden="true" />Masa</dt><dd>{formatTime(event.masa_mula, false, event.timezone)}<small>{event.timezone || 'Asia/Kuala_Lumpur'}</small></dd></div><div><dt><PinIcon aria-hidden="true" />Lokasi</dt><dd>{/^https:\/\//.test(event.lokasi) ? <a href={event.lokasi} target="_blank" rel="noopener noreferrer">Sertai secara dalam talian<LinkDiagonalIcon aria-hidden="true" /></a> : event.lokasi}</dd></div></dl>;
  const organizer = <div className={styles.organizer}>{logo && <img src={logo} alt={`Logo ${event.organizer_name || event.tajuk}`} />}<span>{event.organizer_name || 'Penganjur acara'}</span></div>;

  return <main className={styles.page} style={theme}>
    <nav className={styles.navigation} aria-label="Navigasi acara"><div>{([{ key: 'details', label: 'Butiran acara', href: eventPath(slug) }, { key: 'daftar', label: 'Pendaftaran', href: registerUrl }, { key: 'atur-cara', label: 'Atur cara', href: eventPath(slug, 'atur-cara') }] as const).map(link => <Link key={link.key} href={link.href} aria-current={section === link.key ? 'page' : undefined}>{link.label}</Link>)}</div>{status}</nav>
    {section === 'details' ? <>
      {banner && <div className={styles.banner}><img src={banner} alt={`Banner ${event.tajuk}`} /></div>}
      <div className={`${styles.overview}${event.layout === 'spotlight' ? ` ${styles.spotlight}` : ''}`}>
        <section className={styles.introduction}>{organizer}<h1>{event.tajuk}</h1>{event.tema && <p className={styles.theme}>{event.tema}</p>}{event.description && <p className={styles.description}>{event.description}</p>}<div className={styles.actions}>{passUrl ? <Link href={passUrl} className={styles.primary}><DocumentIcon aria-hidden="true" />Buka pas digital</Link> : event.status_aktif ? <Link href={registerUrl} className={styles.primary}>Daftar penyertaan<ArrowForwardIcon aria-hidden="true" /></Link> : <span className={styles.closedNotice}>Pendaftaran acara ini telah ditutup.</span>}<Link href={eventPath(slug, 'atur-cara')} className={styles.secondary}>Lihat atur cara<ListIcon aria-hidden="true" /></Link></div>{passUrl ? <p className={styles.helper}><CheckCircleIcon aria-hidden="true" />Anda telah mendaftar untuk acara ini.</p> : event.status_aktif && <p className={styles.helper}><CheckShieldIcon aria-hidden="true" />Tiada akaun diperlukan. Pas digital selepas pendaftaran.</p>}</section>
        <aside className={styles.detailsCard} aria-label="Maklumat acara"><h2>Jumpa anda di acara ini</h2>{facts}<div className={styles.detailsNote}><DocumentIcon aria-hidden="true" /><p>Simpan pas digital anda dan tunjukkan kod QR semasa daftar hadir.</p></div></aside>
      </div>
      <section className={styles.nextSteps} aria-label="Panduan penyertaan"><div><span>1</span><p><strong>Daftar penyertaan</strong>Lengkapkan maklumat peserta.</p></div><div><span>2</span><p><strong>Simpan pas digital</strong>Simpan pautannya untuk rujukan.</p></div><div><span>3</span><p><strong>Hadir ke acara</strong>Tunjukkan pas semasa daftar hadir.</p></div></section>
    </> : <>
      <header className={styles.sectionHeading}><p className={styles.sectionEventName}>{event.tajuk}</p><h1>{section === 'daftar' ? 'Daftar penyertaan' : 'Atur cara acara'}</h1><p>{section === 'daftar' ? 'Beberapa butiran sahaja, kemudian pas digital anda tersedia.' : 'Ikuti susunan aktiviti dan rancang penyertaan anda.'}</p></header>
      <div className={styles.sectionLayout}><aside className={styles.summary}>{banner && <img src={banner} alt={`Banner ${event.tajuk}`} className={styles.summaryBanner} />}<div>{organizer}<h2>{event.tajuk}</h2>{event.tema && <p className={styles.summaryTheme}>{event.tema}</p>}{facts}<Link href={eventPath(slug)} className={styles.summaryLink}>Lihat butiran acara<ArrowForwardIcon aria-hidden="true" /></Link></div></aside>
        {section === 'daftar' ? <section className={styles.formPanel}>{checkingPass ? <div className={styles.empty} role="status"><ReloadIcon aria-hidden="true" className={styles.spinning}/><h2>Menyemak pas digital…</h2></div> : passUrl ? <div className={styles.savedPass}><span><CheckCircleIcon aria-hidden="true" /></span><h2>Penyertaan anda telah didaftarkan</h2><p>Pas digital anda sudah tersedia. Simpan pautan pas dan tunjukkannya semasa daftar hadir.</p><Link href={passUrl} className={styles.primary}>Buka pas digital<DocumentIcon aria-hidden="true" /></Link></div> : <RegistrationForm session={event} title="Maklumat peserta" />}</section> : <section className={styles.agendaPanel} aria-label="Senarai atur cara">{agendaState === 'loading' ? <div role="status" className={styles.empty}><ReloadIcon aria-hidden="true" className={styles.spinning} /><h2>Memuatkan atur cara…</h2><p>Sila tunggu sebentar.</p></div> : agendaState === 'error' ? <div role="alert" className={styles.empty}><ListIcon aria-hidden="true" /><h2>Atur cara belum dapat dimuatkan</h2><p>Semak sambungan anda dan cuba sekali lagi.</p><button type="button" className={styles.secondary} onClick={() => { setAgendaState('loading'); setAgendaAttempt(value => value + 1); }}>Cuba lagi</button></div> : !agenda.length ? <div className={styles.empty}><CalendarIcon aria-hidden="true" /><h2>Atur cara akan dikemas kini</h2><p>Penganjur belum menambah aktiviti. Semak semula halaman ini untuk perkembangan acara.</p></div> : <><div className={styles.agendaHeading}><h2>Perjalanan acara</h2><span>{agenda.length} aktiviti</span></div><ol className={styles.timeline}>{agenda.map(item => <li key={item.id}><div className={styles.agendaTime}><time>{item.masa_mula ? formatTime(item.masa_mula) : 'Mengikut turutan'}</time>{item.masa_tamat && <small>hingga {formatTime(item.masa_tamat)}</small>}</div><div className={styles.agendaContent}><h3>{item.tajuk_agenda}</h3>{item.keterangan && <p>{item.keterangan}</p>}{item.status_selesai && <span className={styles.completed}><CheckCircleIcon aria-hidden="true" />Selesai</span>}</div></li>)}</ol></>}</section>}
      </div>
    </>}
    <footer className={styles.footer}><p>{event.organizer_name || 'JPAEvents'}</p><span>Diurus melalui <Link href="/">JPAEvents</Link></span></footer>
  </main>;
}
