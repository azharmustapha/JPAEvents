'use client';


import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOrganizer } from '@/components/organizer-provider';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { KehadiranPeserta, PassportData } from '@/types/database';
import { filterAttendance, passportNumber } from '@/lib/attendance';
import { AdminPassportDialog } from '@/components/admin-passport-dialog';
import { escapeCsvCell } from '@/lib/csv';
import { startPolling } from '@/lib/polling';
import { loadAttendance } from '@/lib/admin-data';
import { formatDate, formatTime } from '@/lib/date';
import { Users, Download, Search, RefreshCw, Ticket, Copy, Check, X, CircleCheck } from '@/components/ui-icons';

export default function AttendancePage() {
    const { event: selectedSession, loading } = useOrganizer();
    const sesiDipilih = selectedSession?.id || '';
    const [senaraiKehadiran, setSenaraiKehadiran] = useState<KehadiranPeserta[]>([]);
    const [attendanceError, setAttendanceError] = useState('');
    const [attendanceSession, setAttendanceSession] = useState('');

    const [search, setSearch] = useState('');
    const [passportPreview, setPassportPreview] = useState<PassportData | null>(null);
    const [copyingPassport, setCopyingPassport] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<{
        sessionId: string;
        participantId: string;
        name: string;
        url: string;
        copied: boolean;
    } | null>(null);

    useEffect(() => {
        if (!sesiDipilih) return;
        return startPolling(() => loadAttendance(getBrowserSupabase(), sesiDipilih), rows => {
            setSenaraiKehadiran(rows);
            setAttendanceSession(sesiDipilih);
            setAttendanceError('');
        }, () => {
            setSenaraiKehadiran([]);
            setAttendanceSession(sesiDipilih);
            setAttendanceError('Kehadiran tidak dapat dimuatkan. Semak sambungan dan akses pentadbir.');
        });
    }, [sesiDipilih]);

    const handleMuatTurunLaporan = () => {
        if (attendanceSession !== sesiDipilih || attendanceError) return;
        if (senaraiKehadiran.length === 0) {
            alert("Tiada rekod kehadiran untuk sesi ini.");
            return;
        }
        const sesiAktifInfo = selectedSession;
        const namaFail = `Laporan_Kehadiran_${sesiAktifInfo?.kod_sesi || 'JPAEvents'}.csv`;

        const tajukLajur = ['NAMA PESERTA', 'ORGANISASI / KUMPULAN', 'E-MEL', 'WAKTU PENDAFTARAN', 'NO. PASPORT', 'WAKTU DAFTAR HADIR'];
        const kandunganCSV = [
            tajukLajur.map(escapeCsvCell).join(','),
            ...senaraiKehadiran.map(rekod => [
                rekod.nama_pegawai,
                rekod.bahagian_unit,
                rekod.emel || '',
                `${formatDate(rekod.waktu_hadir, sesiAktifInfo?.timezone)} ${formatTime(rekod.waktu_hadir, true, sesiAktifInfo?.timezone)}`,
                passportNumber(rekod.no_pasport),
                rekod.checked_in_at ? `${formatDate(rekod.checked_in_at, sesiAktifInfo?.timezone)} ${formatTime(rekod.checked_in_at, true, sesiAktifInfo?.timezone)}` : ''
            ].map(escapeCsvCell).join(','))
        ].join('\r\n');

        const blob = new Blob(['\uFEFF', kandunganCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const pautan = document.createElement('a');
        pautan.setAttribute('href', url);
        pautan.setAttribute('download', namaFail);
        pautan.style.visibility = 'hidden';
        document.body.appendChild(pautan);
        pautan.click();
        document.body.removeChild(pautan);
        URL.revokeObjectURL(url);
    };

    const handleCopyPassportLink = async (peserta: KehadiranPeserta) => {
        const url = new URL(`/pasport/${encodeURIComponent(peserta.token_pasport)}`, window.location.origin).href;
        const feedback = {
            sessionId: peserta.perhimpunan_id,
            participantId: peserta.id,
            name: peserta.nama_pegawai,
            url,
        };
        setCopyingPassport(peserta.id);
        setCopyFeedback(null);
        try {
            await navigator.clipboard.writeText(url);
            setCopyFeedback({ ...feedback, copied: true });
        } catch {
            setCopyFeedback({ ...feedback, copied: false });
        } finally {
            setCopyingPassport(null);
        }
    };

    const visibleAttendance = attendanceSession === sesiDipilih ? senaraiKehadiran : [];
    const visibleCopyFeedback = copyFeedback?.sessionId === sesiDipilih ? copyFeedback : null;
    const attendanceLoading = Boolean(sesiDipilih) && attendanceSession !== sesiDipilih;
    const filteredAttendance = filterAttendance(visibleAttendance, search);
    const hasSearch = Boolean(search.trim());

    const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] disabled:cursor-not-allowed disabled:opacity-40';
    return (
        <main className="organizer-dashboard attendance-page text-[#003053]">
            <div className="mx-auto max-w-7xl space-y-7">
                <header className="standalone-heading"><div><h1>Kehadiran</h1><p>Semak pendaftaran peserta, cari rekod dan muat turun laporan acara.</p></div></header>
                {attendanceError && <p role="alert" className="form-error">{attendanceError}</p>}
                <div className="attendance-summary" aria-label="Ringkasan kehadiran">
                    <p><strong>{loading || attendanceLoading || attendanceError || !sesiDipilih ? '—' : visibleAttendance.length}</strong><span>Peserta berdaftar</span></p>
                    <p><strong>{loading || attendanceLoading || attendanceError || !sesiDipilih ? '—' : visibleAttendance.filter(row => row.checked_in_at).length}</strong><span>Sudah daftar hadir</span></p>
                    <p><strong>{loading || attendanceLoading || attendanceError || !sesiDipilih ? '—' : visibleAttendance.filter(row => !row.checked_in_at).length}</strong><span>Belum daftar hadir</span></p>
                </div>
                <section id="attendance" aria-labelledby="attendance-title" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-6 sm:px-6">
                        <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-[#edf3f7]"><Users className="size-5" /></div><div><h2 id="attendance-title" className="text-lg font-semibold">Senarai kehadiran</h2><p className="mt-0.5 text-xs text-slate-500">Semak rekod dan jana semula pasport peserta.</p></div></div>
                        <button type="button" onClick={handleMuatTurunLaporan} disabled={!sesiDipilih || attendanceLoading || Boolean(attendanceError) || visibleAttendance.length === 0} className={actionClass + ' border border-slate-200 hover:bg-slate-50'}><Download className="size-4" /> Laporan CSV sesi</button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
                        <div className="relative w-full sm:max-w-md">
                            <label htmlFor="attendance-search" className="sr-only">Cari kehadiran mengikut nama, bahagian, e-mel atau nombor pasport</label>
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <input id="attendance-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, unit, e-mel, no. pasport…" className="min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm placeholder:text-slate-400 focus:border-[#003053] focus:bg-white focus:outline-2 focus:outline-offset-2 focus:outline-[#003053] [&::-webkit-search-cancel-button]:appearance-none" />
                            {search && <button type="button" onClick={() => setSearch('')} aria-label="Kosongkan carian" className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-[#003053]"><X className="size-4" /></button>}
                        </div>
                        <p role="status" className="text-xs text-slate-500">{loading || attendanceLoading ? 'Memuatkan kehadiran…' : attendanceError ? 'Kehadiran tidak tersedia' : !sesiDipilih ? 'Tiada sesi dipilih' : <><span className="font-semibold text-[#003053]">{filteredAttendance.length}</span> {hasSearch ? 'daripada ' + visibleAttendance.length + ' rekod' : 'rekod kehadiran'}</>}</p>
                    </div>
                    {visibleCopyFeedback && <div className="mx-5 mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:mx-6">
                        <p role="status" className={'text-sm ' + (visibleCopyFeedback.copied ? 'text-emerald-700' : 'text-slate-600')}>
                            {visibleCopyFeedback.copied
                                ? `Pautan pasport untuk ${visibleCopyFeedback.name} telah disalin. Sedia untuk dihantar kepada peserta.`
                                : `Pautan pasport untuk ${visibleCopyFeedback.name} tidak dapat disalin secara automatik. Pilih dan salin pautan di bawah.`}
                        </p>
                        {!visibleCopyFeedback.copied && <div className="mt-3">
                            <label htmlFor="passport-link-fallback" className="sr-only">Pautan pasport untuk disalin</label>
                            <input id="passport-link-fallback" type="text" readOnly value={visibleCopyFeedback.url} onFocus={event => event.currentTarget.select()}
                                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#003053] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053]" />
                        </div>}
                    </div>}
                    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Jadual kehadiran" aria-busy={loading || attendanceLoading}>
                        <table className="w-full border-collapse text-left text-sm">
                            <caption className="sr-only">Kehadiran sesi {selectedSession?.kod_sesi || 'perhimpunan'}; tindakan jana semula pasport pada setiap rekod.</caption>
                            <thead className="border-y border-slate-200 bg-slate-50 text-xs font-medium text-slate-500"><tr>
                                <th scope="col" className="min-w-60 px-5 py-3.5 sm:pl-6">Nama peserta</th><th scope="col" className="min-w-40 px-4 py-3.5">Bahagian / Unit</th><th scope="col" className="min-w-52 px-4 py-3.5">E-mel</th><th scope="col" className="whitespace-nowrap px-4 py-3.5">Waktu hadir</th><th scope="col" className="whitespace-nowrap px-4 py-3.5">No. pasport</th><th scope="col" className="sticky right-0 bg-slate-50 px-5 py-3.5 text-center whitespace-nowrap sm:pr-6">Tindakan</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {!loading && !attendanceLoading && !attendanceError && filteredAttendance.map(peserta => <tr key={peserta.id} className="hover:bg-[#f7fafc]">
                                    <th scope="row" className="px-5 py-4 text-left sm:pl-6"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf3f7] text-xs font-semibold text-[#42647c]">{peserta.nama_pegawai.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span><span className="font-semibold leading-relaxed">{peserta.nama_pegawai}</span></div></th>
                                    <td className="px-4 py-4 text-slate-500">{peserta.bahagian_unit}</td>
                                    <td className="max-w-64 break-words px-4 py-4 text-slate-500">{peserta.emel || '—'}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums text-slate-600">{formatTime(peserta.waktu_hadir, true, selectedSession?.timezone)}</td>
                                    <td className="px-4 py-4"><Link href={`/pasport/${encodeURIComponent(peserta.token_pasport)}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold tabular-nums hover:border-[#003053] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053]" aria-label={`Buka pasport nombor ${passportNumber(peserta.no_pasport)} untuk ${peserta.nama_pegawai}`}><Ticket className="size-3.5 text-slate-400" />{passportNumber(peserta.no_pasport)}</Link></td>
                                    <td className="sticky right-0 bg-white px-5 py-3 text-center sm:pr-6">
                                        <div className="flex items-center justify-center gap-2">
                                            <button type="button" disabled={copyingPassport !== null} onClick={() => handleCopyPassportLink(peserta)}
                                                aria-label={`Salin pautan pasport untuk ${peserta.nama_pegawai}`} title={visibleCopyFeedback?.participantId === peserta.id && visibleCopyFeedback.copied ? 'Pautan pasport disalin' : 'Salin pautan pasport'}
                                                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#003053] transition-colors hover:border-[#b69a60] hover:bg-[#faf8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] disabled:opacity-40">
                                                {visibleCopyFeedback?.participantId === peserta.id && visibleCopyFeedback.copied ? <Check className="size-4 text-emerald-700" /> : <Copy className="size-4" />}
                                            </button>
                                            <button type="button" disabled={!selectedSession} onClick={() => { if (selectedSession) setPassportPreview({ ...peserta, perhimpunan: selectedSession }); }} aria-label={`Jana semula pasport untuk ${peserta.nama_pegawai}`} title="Jana semula pasport" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#003053] transition-colors hover:border-[#b69a60] hover:bg-[#faf8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] disabled:opacity-40"><RefreshCw className="size-4" /></button>
                                        </div>
                                    </td>
                                </tr>)}
                                {(loading || attendanceLoading || attendanceError || !filteredAttendance.length) && <tr><td colSpan={6} className="px-6 py-14 text-center">
                                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">{loading || attendanceLoading ? <RefreshCw className="size-5 animate-spin motion-reduce:animate-none" /> : hasSearch ? <Search className="size-5" /> : <Users className="size-5" />}</div>
                                    <p className="font-medium">{loading || attendanceLoading ? 'Memuatkan kehadiran…' : attendanceError ? 'Kehadiran tidak dapat dimuatkan' : !sesiDipilih ? 'Belum ada acara' : hasSearch ? 'Tiada padanan carian' : 'Belum ada rekod kehadiran'}</p>
                                    <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">{loading || attendanceLoading ? 'Sila tunggu sebentar.' : attendanceError ? 'Semak sambungan dan akses pentadbir. Sistem akan mencuba semula secara automatik.' : !sesiDipilih ? 'Daftar sesi baharu untuk mula mengurus kehadiran.' : hasSearch ? 'Cuba nama, bahagian, e-mel atau nombor pasport yang lain.' : 'Rekod peserta akan dipaparkan selepas pendaftaran.'}</p>
                                    {hasSearch && !loading && !attendanceLoading && !attendanceError && <button type="button" onClick={() => setSearch('')} className="mt-4 min-h-11 px-3 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#003053]">Kosongkan carian</button>}
                                </td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5 text-xs text-slate-500 sm:px-6"><span className="flex items-center gap-1.5"><CircleCheck className="size-3.5 text-emerald-600" />Rekod pendaftaran kehadiran</span><span>Gunakan ikon <Copy className="mx-1 inline size-3" /> untuk salin pautan atau <RefreshCw className="mx-1 inline size-3" /> untuk jana semula pasport.</span></div>
                </section>
            </div>
            {passportPreview && <AdminPassportDialog data={passportPreview} onClose={() => setPassportPreview(null)} />}
        </main>
    );
}

