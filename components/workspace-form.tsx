'use client';
import {useState,type FormEvent} from 'react';
import {getBrowserSupabase} from '@/lib/supabaseClient';
export function WorkspaceForm(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{const name=String(new FormData(event.currentTarget).get('name')).trim();const {error}=await getBrowserSupabase().rpc('create_workspace',{workspace_name:name});if(error)throw error;window.location.replace('/admin');}catch{setError('Ruang tidak dapat dicipta. Semak pengesahan e-mel dan pastikan pangkalan data JPAEvents telah disediakan.');setBusy(false);}}
 return <form onSubmit={submit} className="editor-panel"><label>Nama penganjur<input name="name" required maxLength={200} disabled={busy} autoComplete="organization"/></label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="primary-action" disabled={busy}>{busy?'Menyediakan…':'Buka ruang saya'}</button></form>;
}
