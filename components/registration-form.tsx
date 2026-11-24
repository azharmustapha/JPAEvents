'use client';
import { useState, type FormEvent, useId } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { normalizeRegistration, isPassportToken } from '@/lib/attendance';
import { contrastText } from '@/lib/events';
import type { Acara } from '@/types/database';
export function RegistrationForm({session,fetching=false,sessionError=''}:{session:Acara|null;fetching?:boolean;sessionError?:string}){
 const router=useRouter(),id=useId();
 const [name,setName]=useState(''),[organization,setOrganization]=useState(''),[email,setEmail]=useState(''),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[closed,setClosed]=useState(false);
 const unavailable=fetching||!session||!session.status_aktif||closed;
 const consent=session?.consent_text?.trim()||'';
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(unavailable||busy||!session)return;setBusy(true);setError('');try{
  const payload=normalizeRegistration(session.kod_sesi,name,organization,email,accepted,session);
  const {data,error}=await getBrowserSupabase().rpc('register_event_attendance',{event_id:session.id,officer_name:payload.officer_name,division:payload.division,email_address:payload.email_address,consent_accepted:payload.pledge_accepted,expected_consent_text:consent||null});
  if(error){if(error.code==='23505')throw new Error('Nama ini telah didaftarkan. Buka pas yang disimpan atau hubungi penganjur.');if(error.code==='P0001'){setClosed(true);throw new Error('Pendaftaran telah ditutup. Hubungi penganjur untuk maklumat lanjut.');}throw new Error(error.code==='22023'?'Maklumat atau persetujuan acara telah berubah. Muat semula halaman, semak butiran terkini dan cuba lagi.':'Pendaftaran gagal. Semak sambungan dan cuba lagi.');}
  if(typeof data!=='string'||!isPassportToken(data))throw new Error('Pas digital tidak dapat dijana.');
  try{localStorage.setItem(`jpaevents_pasport_${session.kod_sesi}`,data);}catch{}
  router.push(`/pasport/${encodeURIComponent(data)}`);
 }catch(cause){setError(cause instanceof Error?cause.message:'Pendaftaran gagal.');}finally{setBusy(false);}}
 const primary=session?.primary_color||'#003053';
 return <section className="registration-panel" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`} className="text-2xl font-bold">Daftar untuk acara</h2><p className="mt-3 text-sm text-slate-600">Isi maklumat anda untuk mendapatkan pas digital. Tiada akaun diperlukan.</p>{fetching&&<p role="status">Memuatkan acara…</p>}{(error||sessionError)&&<p role="alert" className="form-error">{error||sessionError}</p>}{!fetching&&unavailable&&!sessionError&&<p role="status" className="mt-5">Pendaftaran ditutup.</p>}
 <form onSubmit={submit} className="event-registration-form"><fieldset disabled={unavailable||busy}><label htmlFor={`${id}-name`}>Nama penuh<input id={`${id}-name`} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={200}/></label><label htmlFor={`${id}-email`}>E-mel<input id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label><label htmlFor={`${id}-organization`}>Organisasi / kumpulan {session?.require_organization?'':'(pilihan)'}<input id={`${id}-organization`} autoComplete="organization" value={organization} onChange={e=>setOrganization(e.target.value)} required={Boolean(session?.require_organization)} maxLength={200}/></label>{consent&&<label className="check-label"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required/><span>{consent}</span></label>}<button className="primary-action w-full" style={{background:primary,color:contrastText(primary)}} disabled={unavailable||busy||Boolean(consent&&!accepted)}>{busy?'Mendaftar…':'Daftar & dapatkan pas digital'}</button></fieldset></form><p className="mt-4 text-xs text-slate-600">Simpan pautan pas anda selepas pendaftaran.</p></section>;
}
