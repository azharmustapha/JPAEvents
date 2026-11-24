'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { loadPublishedSnapshot } from '@/lib/public-event-data';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { startPolling } from '@/lib/polling';
import { safeEventAsset } from '@/lib/event-assets';
import { eventPath } from '@/lib/events';
import { formatDate } from '@/lib/date';
import { EventTheme } from '@/components/event-theme';
import type { Acara } from '@/types/database';
const subscribeOrigin=()=>()=>{};
export function EventProjector({event:initial}:{event:Acara}){
 const [snapshot,setSnapshot]=useState<{event:Acara|null;count:number}>({event:initial,count:0});
 const [error,setError]=useState(''),[controlError,setControlError]=useState(''),[clock,setClock]=useState('');
 const screen=useRef<HTMLElement>(null);
 const origin=useSyncExternalStore(subscribeOrigin,()=>window.location.origin,()=>'');
 useEffect(()=>startPolling(()=>loadPublishedSnapshot(getBrowserSupabase(),initial.id),data=>{setSnapshot(data);setError('');},()=>setError('Maklumat tidak dapat dimuatkan. Mencuba semula…')),[initial.id]);
 const event=snapshot.event;
 useEffect(()=>{const tick=()=>setClock(new Intl.DateTimeFormat('ms-MY',{timeZone:event?.timezone||'Asia/Kuala_Lumpur',timeStyle:'medium'}).format(new Date()));const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[event?.timezone]);
 async function fullscreen(){setControlError('');try{if(document.fullscreenElement)await document.exitFullscreen();else await screen.current?.requestFullscreen();}catch{setControlError('Skrin penuh tidak tersedia dalam pelayar ini.');}}
 if(!event||error)return <main className="public-projector"><h1>{error?'Sambungan terganggu':'Acara tidak tersedia'}</h1><p role="status">{error||'Halaman ini tidak lagi diterbitkan. QR pendaftaran disembunyikan.'}</p><Link href="/">Kembali ke JPAEvents</Link></main>;
 const primary=event.primary_color||'#003053',logo=safeEventAsset(event.logo_url),banner=safeEventAsset(event.banner_url);
 return <main className="public-projector" ref={screen} style={{borderTop:`8px solid ${primary}`}}>{banner&&<img src={banner} alt="Banner acara" className="event-banner"/>}<header><div>{logo&&<img src={logo} alt="Logo acara" className="event-logo"/>}<h1>{event.tajuk}</h1><EventTheme tema={event.tema}/><p>{formatDate(event.tarikh)} • {event.lokasi}</p></div><div><p>{clock||'—'}</p><small>{event.timezone}</small><button className="secondary-action" onClick={()=>void fullscreen()}>Skrin penuh</button></div></header>{controlError&&<p role="alert" className="form-error">{controlError}</p>}<div className="projector-grid"><section><p>Peserta berdaftar</p><strong className="projector-count">{snapshot.count}</strong><p>Terima kasih atas penyertaan anda</p></section><section>{event.status_aktif&&origin?<><QRCodeSVG value={`${origin}${eventPath(event.slug||'','daftar')}`} size={400} marginSize={4} style={{width:'100%',maxWidth:400,height:'auto'}}/><h2>Imbas untuk mendaftar</h2></>:<h2>Pendaftaran ditutup</h2>}</section></div><Link href={eventPath(event.slug||'')}>Kembali ke acara</Link></main>;
}
