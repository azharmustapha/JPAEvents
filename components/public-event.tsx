'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EventProjector } from '@/components/event-projector';
import { RegistrationForm } from '@/components/registration-form';
import { EventTheme } from '@/components/event-theme';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { safeEventAsset } from '@/lib/event-assets';
import { contrastText, eventPath } from '@/lib/events';
import { formatDate, formatTime } from '@/lib/date';
import type { Acara, AturCara } from '@/types/database';
export function PublicEvent({event,section='details'}:{event:Acara;section?:'details'|'daftar'|'atur-cara'|'tayangan'}){
 const [agenda,setAgenda]=useState<AturCara[]>([]),[error,setError]=useState(''),[token,setToken]=useState<string|null>(null);
 useEffect(()=>{try{const saved=localStorage.getItem(`jpaevents_pasport_${event.kod_sesi}`);if(saved){void getBrowserSupabase().rpc('get_passport',{passport_token:saved}).then(({data,error})=>{if(!error&&data?.perhimpunan?.kod_sesi===event.kod_sesi)setToken(saved);});}}catch{}},[event.kod_sesi]);
 useEffect(()=>{if(section!=='atur-cara')return;let active=true;void getBrowserSupabase().from('atur_cara').select('*').eq('perhimpunan_id',event.id).order('turutan',{ascending:true}).then(({data,error})=>{if(active){if(error)setError('Agenda tidak dapat dimuatkan. Cuba muat semula.');else setAgenda(data as AturCara[]);}});return()=>{active=false;};},[section,event.id]);
 const primary=event.primary_color||'#003053',accent=event.accent_color||'#087f8c',logo=safeEventAsset(event.logo_url),banner=safeEventAsset(event.banner_url),slug=event.slug||'';
 if(section==='tayangan')return <EventProjector event={event}/>;
 return <main className={`public-event public-${event.layout||'classic'}`} style={{'--event-primary':primary,'--event-accent':accent} as React.CSSProperties}>{banner&&<div data-passport-theme><img src={banner} alt="Banner acara" className="event-banner"/></div>}<nav className="event-nav" aria-label="Navigasi acara"><Link href={eventPath(slug)}>Butiran</Link><Link href={eventPath(slug,'daftar')}>Pendaftaran</Link><Link href={eventPath(slug,'atur-cara')}>Agenda</Link></nav><div className="public-event-grid"><section className="event-details">{logo&&<img src={logo} alt="Logo acara" className="event-logo"/>}<p className="organizer-name">{event.organizer_name||'JPAEvents'}</p><h1>{event.tajuk}</h1><EventTheme tema={event.tema}/><dl><div><dt>Tarikh & masa</dt><dd>{formatDate(event.tarikh)} • {formatTime(event.masa_mula)}<small className="block">{event.timezone||'Asia/Kuala_Lumpur'}</small></dd></div><div><dt>Lokasi</dt><dd>{/^https:\/\//.test(event.lokasi)?<a href={event.lokasi} target="_blank" rel="noopener noreferrer">{event.lokasi}</a>:event.lokasi}</dd></div></dl><p className="event-description">{event.description}</p><span className="event-open-status">{event.status_aktif?'Pendaftaran dibuka':'Pendaftaran ditutup'}</span></section>
 <section>{section==='atur-cara'?<div className="editor-panel"><h2>Agenda acara</h2>{error&&<p role="alert" className="form-error">{error}</p>}{agenda.length?<ol className="public-agenda">{agenda.map(item=><li key={item.id}><time>{item.masa_mula?formatTime(item.masa_mula):'—'}{item.masa_tamat?` – ${formatTime(item.masa_tamat)}`:''}</time><h3>{item.tajuk_agenda}</h3><p>{item.keterangan}</p>{item.status_selesai&&<small>Selesai</small>}</li>)}</ol>:<p>Agenda akan dipaparkan apabila disediakan oleh penganjur.</p>}</div>:token?<div className="editor-panel"><h2>Pas anda tersedia</h2><p>Anda telah mendaftar untuk acara ini.</p><Link className="primary-action" href={`/pasport/${encodeURIComponent(token)}`} style={{background:primary,color:contrastText(primary)}}>Buka pas digital</Link><small>Simpan pautan pas anda untuk rujukan.</small></div>:<RegistrationForm session={event}/>}</section></div></main>;
}
