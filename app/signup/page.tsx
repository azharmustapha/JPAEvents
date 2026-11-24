'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabaseClient';
export default function SignupPage() {
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [sent,setSent]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form=new FormData(event.currentTarget);
    try {
      const client=getBrowserSupabase();
      const { data,error: failure }=await client.auth.signUp({email:String(form.get('email')).trim(),password:String(form.get('password')),options:{emailRedirectTo: new URL('/auth/confirm',window.location.origin).href}});
      if(failure) throw failure;
      if(data.session) { await client.auth.signOut({scope:'local'}); throw new Error('Pengesahan e-mel perlu diaktifkan oleh pentadbir laman sebelum pendaftaran akaun boleh digunakan.'); }
      setSent(true);
    } catch(cause) {setError(cause instanceof Error ? cause.message : 'Akaun tidak dapat dicipta. Cuba lagi.');}
    finally {setBusy(false);}
  }
  return <main className="account-page"><h1>Cipta akaun penganjur</h1><p>Ruang untuk acara anda, dengan senarai peserta yang hanya boleh diakses oleh anda.</p>{sent ? <section className="editor-panel"><h2>Semak e-mel anda</h2><p>Jika pendaftaran diterima, pautan pengesahan akan dihantar ke e-mel anda. Sahkan e-mel, kemudian log masuk untuk menyediakan ruang penganjur.</p><Link href="/admin/login" className="primary-action">Log masuk</Link></section> : <form onSubmit={submit} className="editor-panel"><fieldset disabled={busy}><label>E-mel<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Kata laluan<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><small>Gunakan sekurang-kurangnya 12 aksara.</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-action" disabled={busy}>{busy?'Mencipta akaun…':'Cipta akaun'}</button></fieldset></form>}<p>Sudah mempunyai akaun? <Link href="/admin/login">Log masuk</Link></p></main>;
}
