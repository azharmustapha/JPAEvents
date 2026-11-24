'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileDown, Loader2, RefreshCw, X } from 'lucide-react';
import { PassportCard } from '@/components/passport-card';
import { passportToPng } from '@/lib/passport-image';
import type { PassportData } from '@/types/database';

export function AdminPassportDialog({ data, onClose }: { data: PassportData; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<'png' | 'pdf' | null>(null);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState<'png' | 'pdf' | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function downloadPassport(format: 'png' | 'pdf') {
    if (!cardRef.current || saving) return;
    setSaving(format);
    setError('');
    setDownloaded(null);
    try {
      if (format === 'pdf') {
        const { downloadPassportPdf } = await import('@/lib/passport-pdf');
        await downloadPassportPdf(cardRef.current, data.nama_pegawai);
      } else {
        const image = await passportToPng(cardRef.current);
        const link = document.createElement('a');
        link.download = `Pasport-JPAEvents-${data.nama_pegawai.replace(/\s+/g, '_')}.png`;
        link.href = image;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setDownloaded(format);
    } catch {
      setError(`${format === 'pdf' ? 'PDF' : 'Imej'} pasport tidak dapat dijana. Semak sambungan dan cuba lagi.`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="passport-dialog-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="fixed inset-0 m-auto max-h-[92svh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-slate-50 p-0 text-[#003053] shadow-2xl backdrop:bg-[#001a30]/60">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 id="passport-dialog-title" className="flex items-center gap-2 font-semibold"><RefreshCw className="size-4" /> Jana semula pasport</h2>
          <p className="mt-1 text-xs text-slate-500">Semak pasport dan muat turun salinan PNG atau PDF.</p>
        </div>
        <button type="button" autoFocus disabled={saving !== null} onClick={onClose} aria-label="Tutup pratonton pasport"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] disabled:opacity-40"><X className="size-5" /></button>
      </div>
      <div className="p-4 sm:p-6"><PassportCard data={data} cardRef={cardRef} /></div>
      <div className="sticky bottom-0 space-y-3 border-t border-slate-200 bg-white p-4 sm:px-6">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {downloaded && <p role="status" className="text-sm text-emerald-700">{downloaded === 'pdf' ? 'PDF' : 'Imej'} pasport telah dijana dan dimuat turun.</p>}
        <button type="button" disabled={saving !== null} onClick={() => downloadPassport('png')} className="primary-action w-full disabled:opacity-50">
          {saving === 'png' ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Download className="size-4" />}
          {saving === 'png' ? 'Menjana imej pasport…' : 'Simpan sebagai PNG'}
        </button>
        <button type="button" disabled={saving !== null} onClick={() => downloadPassport('pdf')} className="primary-action w-full disabled:opacity-50">
          {saving === 'pdf' ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <FileDown className="size-4" />}
          {saving === 'pdf' ? 'Menjana PDF pasport…' : 'Simpan sebagai PDF'}
        </button>
        <p className="text-center text-xs text-slate-500">Pilih PDF untuk klik kod QR selepas dimuat turun. Kod QR dalam PNG boleh diimbas.</p>
      </div>
    </dialog>
  );
}
