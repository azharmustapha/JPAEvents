'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { authOrigin } from '@/lib/auth/urls';
import { ResendConfirmation } from '@/components/resend-confirmation';
export default function SignupPage() {
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [sent,setSent]=useState(false);
  const [email,setEmail]=useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form=new FormData(event.currentTarget);
    try {
      const fullName=String(form.get('full_name')??'').trim();
      if(!fullName) throw new Error('Sila masukkan nama pendaftar.');
      const registeredEmail=String(form.get('email')).trim();
      const client=getBrowserSupabase();
      const { data,error: failure }=await client.auth.signUp({email:registeredEmail,password:String(form.get('password')),options:{data:{full_name:fullName},emailRedirectTo: new URL('/auth/confirm',authOrigin(window.location.origin)).href}});
      if(failure) throw failure;
      if(data.session) { await client.auth.signOut({scope:'local'}); throw new Error('Pengesahan e-mel perlu diaktifkan oleh pentadbir laman sebelum pendaftaran akaun boleh digunakan.'); }
      setEmail(registeredEmail);setSent(true);
    } catch(cause) {setError(cause instanceof Error ? cause.message : 'Akaun tidak dapat dicipta. Cuba lagi.');}
    finally {setBusy(false);}
  }
  return <main className="account-page"><h1>Cipta akaun penganjur</h1><p>Daftar akaun, sahkan e-mel dan namakan ruang penganjur anda. Selepas itu, anda boleh mencipta serta mengurus acara.</p>{sent ? <>
    <section className="editor-panel" role="status"><h2>Semak e-mel anda</h2><p>Jika pendaftaran diterima, e-mel pengesahan akan dihantar ke <strong>{email}</strong>.</p><ol className="list-decimal pl-5 space-y-2"><li>Buka e-mel pengesahan JPAEvents. Semak juga folder spam atau junk.</li><li>Klik <strong>Sahkan e-mel & teruskan</strong> untuk membuka JPAEvents dan menyediakan ruang penganjur anda.</li><li>Jika akaun sudah disahkan, teruskan dengan log masuk menggunakan e-mel dan kata laluan anda.</li></ol><p>Gunakan pautan daripada e-mel yang paling baharu.</p><Link href="/admin/login" className="primary-action">Log masuk penganjur</Link></section>
    <ResendConfirmation initialEmail={email} />
  </> : <form onSubmit={submit} className="editor-panel" aria-busy={busy}><fieldset disabled={busy}><label>Nama pendaftar<input name="full_name" type="text" autoComplete="name" required maxLength={200}/></label><label>E-mel<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Kata laluan<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><small>Gunakan sekurang-kurangnya 12 aksara.</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-action" disabled={busy}>{busy?'Mencipta akaun…':'Cipta akaun'}</button></fieldset></form>}<p>Sudah mempunyai akaun? <Link href="/admin/login">Log masuk</Link></p></main>;
}
