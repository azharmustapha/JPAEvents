'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useOrganizer } from '@/components/organizer-provider';
import { organizerHref } from '@/lib/organizer-navigation';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { AturCara } from '@/types/database';
import { ArrowLeft, ListOrdered, CheckCircle2, AlertCircle, Pencil, Trash2 } from '@/components/ui-icons';
import { formatTime, toTimeInput } from '@/lib/date';
import { TimeInput } from '@/components/time-input';

export default function UrusTentatifPage() {
    const { event, error: sessionError } = useOrganizer();
    const sesiDipilih = event?.id || '';
    const [senaraiAturCara, setSenaraiAturCara] = useState<AturCara[]>([]);
    const [mesej, setMesej] = useState<{ jenis: 'sukses' | 'ralat'; teks: string } | null>(null);

    const [agendaTajuk, setAgendaTajuk] = useState('');
    const [agendaMula, setAgendaMula] = useState('');
    const [agendaTamat, setAgendaTamat] = useState('');
    const [agendaKeterangan, setAgendaKeterangan] = useState('');
    const [agendaTurutan, setAgendaTurutan] = useState(1);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [agendaLoading, setAgendaLoading] = useState(true);
    const titleInputRef = useRef<HTMLInputElement>(null);

    const resetForm = (items: AturCara[]) => {
        setEditingId(null);
        setAgendaTajuk(''); setAgendaMula(''); setAgendaTamat(''); setAgendaKeterangan('');
        setAgendaTurutan(Math.max(0, ...items.map(item => item.turutan)) + 1);
    };

    const handleEditAgenda = (item: AturCara) => {
        setEditingId(item.id);
        setAgendaTajuk(item.tajuk_agenda);
        setAgendaMula(toTimeInput(item.masa_mula));
        setAgendaTamat(toTimeInput(item.masa_tamat));
        setAgendaKeterangan(item.keterangan || '');
        setAgendaTurutan(item.turutan);
        setMesej(null);
        titleInputRef.current?.focus();
        titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        if (!sesiDipilih) return;
        let cancelled = false;
        async function muatAgenda() {
            const { data, error } = await getBrowserSupabase().from('atur_cara').select('*').eq('perhimpunan_id', sesiDipilih).order('turutan', { ascending: true });
            if (cancelled) return;
            setAgendaLoading(false);
            if (error) { setMesej({ jenis: 'ralat', teks: 'Atur cara tidak dapat dimuatkan.' }); setSenaraiAturCara([]); return; }
            setSenaraiAturCara((data as AturCara[]) || []);
            setAgendaTurutan(Math.max(0, ...(data || []).map(item => item.turutan)) + 1);
        }
        muatAgenda();
        return () => { cancelled = true; };
    }, [sesiDipilih]);

    const handleSimpanAgenda = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving || agendaLoading || !sesiDipilih) return;
        setMesej(null);
        try {
            setSaving(true);
            const payload = {
                perhimpunan_id: sesiDipilih, masa_mula: agendaMula || null, masa_tamat: agendaMula ? agendaTamat || null : null, tajuk_agenda: agendaTajuk, keterangan: agendaKeterangan || null, turutan: Number(agendaTurutan)
            };
            const query = getBrowserSupabase().from('atur_cara');
            const { data, error } = editingId
                ? await query.update(payload).eq('id', editingId).eq('perhimpunan_id', sesiDipilih).select('*').single()
                : await query.insert([payload]).select('*').single();
            if (error) throw new Error('Agenda tidak dapat disimpan. Semak maklumat dan akses pentadbir.');
            const items = [...senaraiAturCara.filter(item => item.id !== data.id), data as AturCara]
                .sort((a, b) => a.turutan - b.turutan);
            setSenaraiAturCara(items);
            setMesej({ jenis: 'sukses', teks: editingId ? 'Agenda berjaya dikemas kini!' : 'Agenda berjaya ditambah ke dalam atur cara!' });
            resetForm(items);
        } catch (err) {
            setMesej({ jenis: 'ralat', teks: err instanceof Error ? err.message : 'Gagal menambah agenda.' });
        } finally { setSaving(false); }
    };

    const handlePadamAgenda = async (item: AturCara) => {
        if (saving || agendaLoading || item.perhimpunan_id !== sesiDipilih) return;
        if (!window.confirm(`Padam agenda "${item.tajuk_agenda}"?`)) return;
        setMesej(null);
        setSaving(true);
        try {
            const { error } = await getBrowserSupabase().from('atur_cara').delete()
                .eq('id', item.id).eq('perhimpunan_id', sesiDipilih).select('id').single();
            if (error) throw new Error('Agenda tidak dapat dipadam. Semak sambungan dan akses pentadbir.');
            const items = senaraiAturCara.filter(agenda => agenda.id !== item.id);
            setSenaraiAturCara(items);
            if (editingId === item.id) resetForm(items);
            else if (!editingId) setAgendaTurutan(Math.max(0, ...items.map(agenda => agenda.turutan)) + 1);
            setMesej({ jenis: 'sukses', teks: 'Agenda berjaya dipadam.' });
        } catch (err) {
            setMesej({ jenis: 'ralat', teks: err instanceof Error ? err.message : 'Gagal memadam agenda.' });
        } finally { setSaving(false); }
    };

    return (
        <div className="organizer-agenda text-slate-900 font-sans">
            <div className="max-w-4xl mx-auto">

                <div className="flex items-center gap-4 mb-8">
                    <Link href={organizerHref('/admin', sesiDipilih || null)} aria-label="Kembali ke kehadiran acara" className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-[#003053]" />
                    </Link>
                    <h1 className="text-2xl font-bold text-[#003053] tracking-tight">Pengurusan Tentatif</h1>
                </div>

                {sessionError && <p role="alert" className="form-error">{sessionError}</p>}

                {mesej && (
                    <div role={mesej.jenis === 'ralat' ? 'alert' : 'status'} className={`p-4 mb-6 rounded-2xl text-sm font-bold flex items-center gap-2 border ${mesej.jenis === 'sukses' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'
                        }`}>
                        {mesej.jenis === 'sukses' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span>{mesej.teks}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

                    <div className="md:col-span-2 rounded-2xl bg-white border border-slate-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-fit">
                        <h2 className="text-lg font-bold text-[#003053] mb-6">{editingId ? 'Edit Agenda' : 'Borang Agenda'}</h2>
                        <form onSubmit={handleSimpanAgenda}>
                          <fieldset disabled={saving || agendaLoading || !sesiDipilih} className="space-y-5 disabled:opacity-50">
                            <div>
                                <label htmlFor="agenda-title" className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Aktiviti / Tajuk</label>
                                <input id="agenda-title" ref={titleInputRef} type="text" required placeholder="Cth: Ucapan Perasmian" value={agendaTajuk} onChange={(e) => setAgendaTajuk(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-[#003053] focus:outline-none focus:border-black transition-all" />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label htmlFor="agenda-start" className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Masa Mula (Pilihan)</label>
                                    <TimeInput id="agenda-start" value={agendaMula} onChange={value => { setAgendaMula(value); if (!value) setAgendaTamat(''); }} />
                                    <p className="mt-2 text-xs text-slate-500">Kosongkan jika aktiviti ini mengikuti aktiviti sebelumnya tanpa masa khusus. Susunan mengikut turutan.</p>
                                </div>
                                <div>
                                    <label htmlFor="agenda-end" className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Masa Tamat (Pilihan)</label>
                                    <TimeInput id="agenda-end" disabled={!agendaMula} value={agendaTamat} onChange={setAgendaTamat} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="agenda-order" className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Turutan</label>
                                    <input id="agenda-order" type="number" required value={agendaTurutan} onChange={(e) => setAgendaTurutan(Number(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-[#003053] focus:outline-none focus:border-black transition-all" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="agenda-description" className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Keterangan (Pilihan)</label>
                                <textarea id="agenda-description" rows={2} placeholder="Butiran tambahan..." value={agendaKeterangan} onChange={(e) => setAgendaKeterangan(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-[#003053] focus:outline-none focus:border-black transition-all" />
                            </div>
                            <button type="submit" disabled={saving || agendaLoading || !sesiDipilih} className="w-full py-4 rounded-full bg-[#003053] text-white text-sm font-bold shadow-lg hover:bg-[#003053]/90 transition-colors mt-2 disabled:opacity-50">
                                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Agenda'}
                            </button>
                            {editingId && <button type="button" onClick={() => resetForm(senaraiAturCara)} className="w-full py-3 text-sm font-bold text-slate-500">Batal Edit</button>}
                          </fieldset>
                        </form>
                    </div>

                    <div className="md:col-span-3 rounded-2xl bg-white border border-slate-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex items-center gap-2 mb-6 text-lg font-bold text-[#003053]">
                            <ListOrdered className="w-5 h-5" />
                            <h2>Senarai Tentatif Semasa</h2>
                        </div>

                        <div className="space-y-4">
                            {agendaLoading && sesiDipilih ? (
                                <div role="status" className="text-center text-slate-500 py-8 text-sm">Memuatkan atur cara...</div>
                            ) : senaraiAturCara.length === 0 ? (
                                <div className="text-center text-slate-500 py-8 font-medium text-sm">Tiada agenda ditambah.</div>
                            ) : (
                                senaraiAturCara.map((item) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap items-start gap-3">
                                        <div className="bg-white px-2 py-1 rounded border border-slate-100 text-[10px] font-bold text-slate-500 uppercase mt-0.5 shadow-sm">
                                            #{item.turutan}
                                        </div>
                                        <div className="flex-1 min-w-0 basis-40">
                                            <div className="text-slate-500 font-bold text-sm mb-1">{item.masa_mula ? `${formatTime(item.masa_mula)}${item.masa_tamat ? ` - ${formatTime(item.masa_tamat)}` : ''}` : 'Mengikut turutan'}</div>
                                            <div className="font-bold text-[#003053] text-base break-words">{item.tajuk_agenda}</div>
                                            {item.keterangan && <div className="text-sm text-slate-500 mt-1 break-words">{item.keterangan}</div>}
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-auto">
                                            <button type="button" onClick={() => handleEditAgenda(item)} disabled={saving || agendaLoading} aria-label={`Edit agenda: ${item.tajuk_agenda}`} title="Edit agenda" className="p-2 rounded-lg text-[#003053] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#003053] disabled:opacity-50">
                                                <Pencil aria-hidden="true" className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={() => handlePadamAgenda(item)} disabled={saving || agendaLoading} aria-label={`Padam agenda: ${item.tajuk_agenda}`} title="Padam agenda" className="p-2 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50">
                                                <Trash2 aria-hidden="true" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
