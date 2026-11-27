'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { contrastText, eventPath, validateEventSettings, validateImageUpload } from '@/lib/events';
import { safeEventAsset } from '@/lib/event-assets';
import { eventAssetsBucket } from '@/lib/supabase/project-routing';
import { useOrganizer } from '@/components/organizer-provider';
import { organizerHref } from '@/lib/organizer-navigation';
import { ArrowLeft, ArrowUpRight, Calendar, CheckCircle2, Clock, MapPin, PlusCircle, ShieldCheck, Sparkles, Ticket, Users, X } from '@/components/ui-icons';
import styles from './event-editor.module.css';
type Settings = Record<string, string | number | boolean | null>;
const defaults:Settings={tajuk:'',tema:'',tarikh:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}),masa_mula:'09:00',lokasi:'',kod_sesi:'',slug:'',description:'',organizer_name:'',timezone:'Asia/Kuala_Lumpur',primary_color:'#003053',accent_color:'#087f8c',layout:'classic',logo_url:null,banner_url:null,require_organization:false,consent_text:'',draw_exclude_first:0,published:false,status_aktif:false,workspace_id:''};
export function EventEditor({eventId}:{eventId?:string}) {
 const { refreshEvents } = useOrganizer();
 const [settings,setSettings]=useState<Settings>(defaults),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const [savedSettings,setSavedSettings]=useState(''),[publishedPath,setPublishedPath]=useState<string|null>(null);
 function change(key:string,value:Settings[string]){setSaved('');setSettings(s=>({...s,[key]:value}));}
 useEffect(()=>{let cancelled=false;async function load(){try{
  const client=getBrowserSupabase();const {data:member,error}=await client.from('workspace_members').select('workspace_id').maybeSingle();
  if(error||!member)throw new Error('Ruang penganjur tidak ditemui. Kembali ke Acara saya dan lengkapkan persediaan.');
  let values:Settings={...defaults,workspace_id:member.workspace_id};
  if(eventId){const {data,error}=await client.from('perhimpunan').select('*').eq('id',eventId).eq('workspace_id',member.workspace_id).single();if(error||!data)throw new Error('Acara tidak ditemui atau anda tidak mempunyai akses.');values={...values,...Object.fromEntries(Object.keys(defaults).map(key=>[key,data[key]??defaults[key]]))};}
  if(!cancelled){setSettings(values);setSavedSettings(JSON.stringify(values));setPublishedPath(eventId&&values.published?eventPath(String(values.slug)):null);}
 }catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:'Maklumat tidak dapat dimuatkan.');}finally{if(!cancelled)setLoading(false);}}void load();return()=>{cancelled=true;};},[eventId]);
 async function upload(kind:'logo_url'|'banner_url',file?:File){if(!file)return;setError('');setUploading(true);try{
  const extension=validateImageUpload(file);const bitmap=await createImageBitmap(file);const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>40_000_000)throw new Error('Imej terlalu besar. Gunakan imej sehingga 40 megapiksel.');
  const client=getBrowserSupabase(),path=`${settings.workspace_id}/${crypto.randomUUID()}.${extension}`;
  const {error}=await client.storage.from(eventAssetsBucket()).upload(path,file,{upsert:false,contentType:file.type});if(error)throw new Error('Muat naik gagal. Pastikan storan imej telah disediakan dan cuba lagi.');
  change(kind,client.storage.from(eventAssetsBucket()).getPublicUrl(path).data.publicUrl);
 }catch(cause){setError(cause instanceof Error?cause.message:'Muat naik gagal.');}finally{setUploading(false);}}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');setSaved('');setBusy(true);try{
  validateEventSettings(settings);if(settings.status_aktif&&!settings.published)throw new Error('Terbitkan acara sebelum membuka pendaftaran.');
  const {data,error}=await getBrowserSupabase().rpc('save_event',{event_id:eventId??null,event_settings:settings});
  if(error)throw new Error(error.code==='23505'?'Kod atau pautan acara telah digunakan. Pilih yang lain.':error.message||'Acara tidak dapat disimpan.');
  if(!eventId){window.location.replace(`/admin/events/${data}`);return;}setSaved('Perubahan disimpan.');setSavedSettings(JSON.stringify(settings));setPublishedPath(settings.published?eventPath(String(settings.slug)):null);void refreshEvents().catch(()=>{});
 }catch(cause){setError(cause instanceof Error?cause.message:'Acara tidak dapat disimpan.');}finally{setBusy(false);}}
 function text(key:string,label:string,extra:InputHTMLAttributes<HTMLInputElement>={},hint?:string){return <label className={styles.field} key={key}><span id={`event-${key}-label`}>{label}{extra.required&&<span className={styles.required} aria-hidden="true"> *</span>}</span><input aria-labelledby={`event-${key}-label`} aria-describedby={hint?`event-${key}-hint`:undefined} value={String(settings[key]??'')} onChange={e=>change(key,e.target.value)} {...extra}/>{hint&&<small id={`event-${key}-hint`}>{hint}</small>}</label>;}
 if(loading)return <main className={styles.page}><div className={styles.loading} role="status"><Calendar/><p>Memuatkan tetapan acara…</p></div></main>;
 if(!settings.workspace_id)return <main className={styles.page}><p role="alert" className={styles.error}>{error}</p><Link href="/onboarding">Sediakan ruang penganjur</Link></main>;
 const primary=String(settings.primary_color),accent=String(settings.accent_color),logo=safeEventAsset(String(settings.logo_url??'')),banner=safeEventAsset(String(settings.banner_url??''));
 const dirty=JSON.stringify(settings)!==savedSettings;
 const eventDate=String(settings.tarikh);
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(eventDate)&&!Number.isNaN(Date.parse(eventDate));
 const dateLabel=validDate?new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${eventDate}T00:00:00Z`)):'Tarikh acara';
 const status=settings.published?(settings.status_aktif?'Pendaftaran dibuka':'Telah diterbitkan'):'Draf';
 return <main className={styles.page}>
  <Link href={organizerHref('/admin',eventId??null)} className={styles.back}><ArrowLeft aria-hidden="true"/>Acara saya</Link>
  <header className={styles.heading}><div><h1>{eventId?'Kemas kini acara':'Cipta acara'}</h1><p>Atur butiran, serlahkan identiti dan sediakan acara untuk peserta anda.</p></div><span className={`${styles.status} ${settings.published?styles.statusPublished:''}`}><span/>{status}</span></header>
  <nav className={styles.navigation} aria-label="Bahagian tetapan acara">
   <a href="#butiran-acara"><Ticket aria-hidden="true"/>Butiran acara</a><a href="#identiti-acara"><Sparkles aria-hidden="true"/>Tema & identiti</a><a href="#pendaftaran-acara"><Users aria-hidden="true"/>Pendaftaran</a><a href="#terbitkan-acara"><ShieldCheck aria-hidden="true"/>Penerbitan</a>
  </nav>
  <div className={styles.workspace}>
   <form id="event-settings" className={styles.form} onSubmit={submit}>
    <fieldset disabled={busy||uploading} className={styles.fieldset}>
     <section id="butiran-acara" className={styles.section} aria-labelledby="butiran-heading">
      <header className={styles.sectionHeading}><span className={styles.sectionIcon}><Ticket aria-hidden="true"/></span><div><h2 id="butiran-heading">Butiran acara</h2><p>Maklumat utama yang akan dilihat oleh peserta.</p></div></header>
      <p className={styles.requiredNote}>Medan bertanda <span>*</span> wajib diisi.</p>
      {text('tajuk','Nama acara',{required:true,maxLength:200,placeholder:'Contoh: Perhimpunan Bulanan JPA'})}
      {text('organizer_name','Nama penganjur',{maxLength:200,placeholder:'Nama jabatan atau organisasi'})}
      <label className={styles.field}><span>Penerangan acara <em>Pilihan</em></span><textarea value={String(settings.description)} maxLength={2000} rows={4} placeholder="Kongsikan tujuan acara dan perkara yang peserta perlu tahu." onChange={e=>change('description',e.target.value)}/><small>{String(settings.description).length} / 2,000 aksara</small></label>
      <div className={styles.subheading}><Calendar aria-hidden="true"/><h3>Tarikh & tempat</h3></div>
      <div className={styles.columns}>{text('tarikh','Tarikh',{type:'date',required:true})}{text('masa_mula','Masa mula',{type:'time',required:true})}</div>
      {text('lokasi','Lokasi atau pautan mesyuarat',{required:true,maxLength:200,placeholder:'Contoh: Auditorium JPA, Putrajaya'})}
      {text('timezone','Zon masa',{required:true,list:'timezones'},'Waktu Malaysia menggunakan Asia/Kuala_Lumpur.')}
      <datalist id="timezones">{['Asia/Kuala_Lumpur','Asia/Singapore','Asia/Jakarta','Asia/Bangkok','Asia/Tokyo','Australia/Sydney','Europe/London','America/New_York','UTC'].map(z=><option key={z} value={z}/>)}</datalist>
      <div className={styles.subheading}><ArrowUpRight aria-hidden="true"/><h3>Pautan & kod acara</h3></div>
      {text('slug','Pautan acara',{required:true,maxLength:80,pattern:'[a-z0-9]+(-[a-z0-9]+)*',placeholder:'perhimpunan-bulanan-jpa'},'Gunakan huruf kecil, nombor dan sempang sahaja.')}
      <p className={styles.urlPreview}>/events/<strong>{String(settings.slug)||'nama-acara'}</strong></p>
      {text('kod_sesi','Kod acara',{required:true,maxLength:80,placeholder:'Contoh: JPA-2026'},'Kod unik untuk mengenal pasti acara ini.')}
     </section>
     <section id="identiti-acara" className={styles.section} aria-labelledby="identiti-heading">
      <header className={styles.sectionHeading}><span className={styles.sectionIcon}><Sparkles aria-hidden="true"/></span><div><h2 id="identiti-heading">Tema & identiti</h2><p>Sesuaikan halaman acara dengan identiti penganjur anda.</p></div></header>
      {text('tema','Tema atau slogan',{maxLength:500,placeholder:'Contoh: Bersama memacu kecemerlangan'})}
      <div className={styles.columns}>{(['primary_color','accent_color'] as const).map(key=><label className={styles.field} key={key}><span>{key==='primary_color'?'Warna utama':'Warna aksen'}</span><div className={styles.colorControl}><input type="color" aria-label={key==='primary_color'?'Warna utama':'Warna aksen'} value={String(settings[key])} onChange={e=>change(key,e.target.value)}/><span>{String(settings[key]).toUpperCase()}</span></div></label>)}</div>
      <fieldset className={styles.layoutPicker}><legend>Susun atur halaman</legend><div className={styles.columns}>{(['classic','spotlight'] as const).map(layout=><label key={layout} className={`${styles.layoutOption} ${settings.layout===layout?styles.layoutSelected:''}`}><input type="radio" name="event-layout" value={layout} checked={settings.layout===layout} onChange={()=>change('layout',layout)}/><span className={`${styles.layoutSketch} ${layout==='spotlight'?styles.spotlightSketch:''}`} aria-hidden="true"><i/><i/></span><strong>{layout==='classic'?'Klasik':'Sorotan'}</strong><small>{layout==='classic'?'Butiran dan borang bersebelahan':'Banner dan borang berturutan'}</small></label>)}</div></fieldset>
      <div className={styles.columns}>{(['logo_url','banner_url'] as const).map(key=>{
       const image=key==='logo_url'?logo:banner;
       return <div className={styles.asset} key={key}><label className={styles.upload}><strong>{key==='logo_url'?'Logo acara':'Banner acara'}</strong><span className={styles.uploadVisual}>{image?<img src={image} alt={key==='logo_url'?'Logo yang dimuat naik':'Banner yang dimuat naik'} className={key==='logo_url'?styles.logoAsset:styles.bannerAsset}/>:<PlusCircle aria-hidden="true"/>}</span><span className={styles.uploadAction}>{image?'Tukar imej':'Pilih imej'}</span><small>{key==='logo_url'?'Imej segi empat disyorkan':'Saiz disyorkan: 1800 × 600 piksel (nisbah 3:1)'}</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void upload(key,e.target.files?.[0]);e.target.value='';}}/></label>{settings[key]&&<button type="button" className={styles.removeImage} onClick={()=>change(key,null)}><X aria-hidden="true"/>Buang imej</button>}</div>;
      })}</div>
      <p className={styles.hint}>PNG, JPG atau WebP sehingga 5 MB. Imej boleh diakses secara awam; elakkan dokumen peribadi.</p>
      {uploading&&<p role="status" className={styles.uploadStatus}>Memuat naik imej…</p>}
     </section>
     <section id="pendaftaran-acara" className={styles.section} aria-labelledby="pendaftaran-heading">
      <header className={styles.sectionHeading}><span className={styles.sectionIcon}><Users aria-hidden="true"/></span><div><h2 id="pendaftaran-heading">Pendaftaran & cabutan</h2><p>Tentukan maklumat peserta dan kelayakan cabutan.</p></div></header>
      <label className={styles.toggleRow}><span><strong>Wajibkan organisasi / kumpulan</strong><small>Peserta perlu mengisi organisasi ketika mendaftar.</small></span><input type="checkbox" role="switch" aria-label="Wajibkan organisasi / kumpulan" checked={Boolean(settings.require_organization)} onChange={e=>change('require_organization',e.target.checked)}/></label>
      <label className={styles.field}><span>Teks persetujuan <em>Pilihan</em></span><textarea value={String(settings.consent_text??'')} rows={3} maxLength={2000} placeholder="Masukkan persetujuan tambahan untuk peserta, jika perlu." onChange={e=>change('consent_text',e.target.value)}/><small>Kosongkan jika tiada persetujuan tambahan diperlukan.</small></label>
      <label className={styles.field}><span>Pas awal yang dikecualikan daripada cabutan</span><input type="number" min={0} max={10000} value={Number(settings.draw_exclude_first)} onChange={e=>change('draw_exclude_first',Number(e.target.value))}/><small>Contoh: 5 mengecualikan lima pas pertama. Masukkan 0 untuk membenarkan semua peserta.</small></label>
     </section>
     <section id="terbitkan-acara" className={styles.section} aria-labelledby="terbitkan-heading">
      <header className={styles.sectionHeading}><span className={styles.sectionIcon}><ShieldCheck aria-hidden="true"/></span><div><h2 id="terbitkan-heading">Terbitkan & kongsi</h2><p>Kawal bila halaman dan pendaftaran boleh diakses.</p></div></header>
      <label className={styles.toggleRow}><span><strong>Terbitkan halaman acara</strong><small>{settings.published?'Halaman acara boleh diakses melalui pautan awam.':'Draf hanya boleh dilihat dalam ruang penganjur anda.'}</small></span><input type="checkbox" role="switch" aria-label="Terbitkan halaman acara" checked={Boolean(settings.published)} onChange={e=>{setSaved('');setSettings(s=>({...s,published:e.target.checked,status_aktif:e.target.checked?s.status_aktif:false}));}}/></label>
      <label className={`${styles.toggleRow} ${!settings.published?styles.toggleDisabled:''}`}><span><strong>Buka pendaftaran</strong><small>{settings.published?'Benarkan peserta mendaftar untuk acara ini.':'Terbitkan halaman acara untuk membuka pendaftaran.'}</small></span><input type="checkbox" role="switch" aria-label="Buka pendaftaran" disabled={!settings.published} checked={Boolean(settings.status_aktif)} onChange={e=>change('status_aktif',e.target.checked)}/></label>
      <div className={styles.publishNote}><ShieldCheck aria-hidden="true"/><p>Tetapan ini digunakan selepas disimpan. Membuka pendaftaran acara ini tidak menutup acara lain.</p></div>
     </section>
    </fieldset>
   </form>
   <aside className={styles.preview} aria-label="Pratonton halaman acara">
    <div className={styles.previewHeading}><h2>Pratonton acara</h2><span><span/>Paparan langsung</span></div>
    <div className={`${styles.previewCard} ${settings.layout==='spotlight'?styles.spotlight:''}`}>
     <div className={styles.previewCover} style={{background:primary,color:contrastText(primary)}}>
      {banner?<img src={banner} alt="Banner acara" className={styles.coverImage}/>:<div className={styles.coverPattern} aria-hidden="true"><Ticket/></div>}
      <span className={styles.coverTag}>{settings.layout==='classic'?'Klasik':'Sorotan'}</span>
      <div className={styles.coverIdentity}>{logo?<img src={logo} alt="Logo acara"/>:<span className={styles.logoPlaceholder}><Calendar aria-hidden="true"/></span>}<span>{String(settings.organizer_name)||'Nama penganjur'}</span></div>
     </div>
     <div className={styles.previewBody}>
      {settings.tema&&<p className={styles.previewTheme} style={{color:accent}}>{String(settings.tema)}</p>}
      <h3>{String(settings.tajuk)||'Nama acara anda'}</h3>
      <div className={styles.previewDetails}><p><Calendar aria-hidden="true"/><span>{dateLabel}</span></p><p><Clock aria-hidden="true"/><span>{String(settings.masa_mula).slice(0,5)}<small>{String(settings.timezone).replaceAll('_',' ')}</small></span></p><p><MapPin aria-hidden="true"/><span>{String(settings.lokasi)||'Lokasi acara'}</span></p></div>
      {settings.description&&<p className={styles.previewDescription}>{String(settings.description)}</p>}
      {publishedPath?<Link href={publishedPath} target="_blank" rel="noopener noreferrer" className={styles.previewAction} style={{background:primary,color:contrastText(primary)}}>Buka Acara<ArrowUpRight aria-hidden="true"/></Link>:<button type="button" disabled className={styles.previewAction} style={{background:primary,color:contrastText(primary)}}>Buka Acara<ArrowUpRight aria-hidden="true"/></button>}
      {publishedPath?<Link href={`${publishedPath}/tayangan`} target="_blank" rel="noopener noreferrer" className={`${styles.previewAction} ${styles.projectorAction}`} aria-label="Buka tayangan acara dalam tab baharu">Tayangan<ArrowUpRight aria-hidden="true"/></Link>:<button type="button" disabled className={`${styles.previewAction} ${styles.projectorAction}`} title="Simpan dan terbitkan acara untuk membuka tayangan">Tayangan<ArrowUpRight aria-hidden="true"/></button>}
     </div>
    </div>
    <p className={styles.previewHint}>{publishedPath?'Buka Acara dan Tayangan membuka acara yang terakhir disimpan dalam tab baharu.':'Simpan dan terbitkan acara untuk mengaktifkan butang Buka Acara dan Tayangan.'}</p>
    <div className={styles.previewNote}><Sparkles aria-hidden="true"/><p>Pratonton berubah semasa anda menyunting. <strong>Simpan perubahan</strong> untuk mengemas kini halaman acara.</p></div>
   </aside>
  </div>
  <footer className={styles.saveBar}>
   <div className={styles.saveFeedback} aria-live="polite"><div className={styles.saveStatus}>{!dirty&&saved?<><CheckCircle2 aria-hidden="true"/><span>{saved}</span></>:<><span className={dirty?styles.dirtyDot:styles.cleanDot}/><span>{uploading?'Memuat naik imej…':busy?'Menyimpan acara…':dirty?'Ada perubahan belum disimpan':'Semua tetapan telah dimuatkan'}</span></>}</div>{error&&<p role="alert" className={styles.error}>{error}</p>}</div>
   <button form="event-settings" type="submit" className={styles.saveButton} disabled={busy||uploading}><CheckCircle2 aria-hidden="true"/>{busy?'Menyimpan…':eventId?'Simpan perubahan':'Cipta acara'}</button>
  </footer>
 </main>;
}
