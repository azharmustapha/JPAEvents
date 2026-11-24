'use client';


import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { Acara, KehadiranPeserta, PassportData } from '@/types/database';
import { filterAttendance, passportNumber } from '@/lib/attendance';
import { AdminPassportDialog } from '@/components/admin-passport-dialog';
import { escapeCsvCell } from '@/lib/csv';
import { startPolling } from '@/lib/polling';
import { loadAdminSessions, loadAttendance } from '@/lib/admin-data';
import { formatDate, formatTime } from '@/lib/date';
import {
    Calendar,
    Gift,
    Users,
    Tv,
    Download,
    PlusCircle,
    ListOrdered,
    ScanLine,
    Search,
    RefreshCw,
    ArrowUpRight,
    MapPin,
    Clock,
    Ticket,
    Copy,
    Check,
    X,
    LogOut,
    CircleCheck
} from 'lucide-react';

export default function AdminPage() {
    const router = useRouter();
    const [senaraiSesi, setSenaraiSesi] = useState<Acara[]>([]);
    const [sesiDipilih, setSesiDipilih] = useState<string>('');
    const [senaraiKehadiran, setSenaraiKehadiran] = useState<KehadiranPeserta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sessionError, setSessionError] = useState('');
    const [attendanceError, setAttendanceError] = useState('');
    const [attendanceSession, setAttendanceSession] = useState('');
    const [saving, setSaving] = useState(false);

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

    const receiveSessions = useCallback((data: Acara[]) => {
        setSenaraiSesi(data);
        setSessionError('');
        const aktif = data.find(s => s.status_aktif) || data[0];
        setSesiDipilih(current => data.some(s => s.id === current) ? current : aktif?.id || '');
        setLoading(false);
    }, []);

    useEffect(() => startPolling(() => loadAdminSessions(getBrowserSupabase()), receiveSessions,
        () => { setSessionError('Senarai sesi tidak dapat dimuatkan. Semak sambungan dan akses pentadbir.'); setLoading(false); }), [receiveSessions]);

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
        const sesiAktifInfo = senaraiSesi.find(s => s.id === sesiDipilih);
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

    // Fungsi Log Keluar Admin
    const handleLogKeluar = async () => {
        setSaving(true);
        try {
            const { error } = await getBrowserSupabase().auth.signOut({ scope: 'local' });
            if (error) throw error;
            setSenaraiKehadiran([]);
            router.replace('/admin/login');
            router.refresh();
        } catch {
            setError('Log keluar gagal. Sila cuba lagi.');
            setSaving(false);
        }
    };

    const handleSetActive = async (isOpen: boolean) => {
        setSaving(true);
        setError('');
        try {
            const { error } = await getBrowserSupabase().rpc('set_registration_open', { event_id: sesiDipilih, is_open: isOpen });
            if (error) throw error;
            receiveSessions(await loadAdminSessions(getBrowserSupabase()));
        } catch { setError('Status sesi tidak dapat dikemas kini. Semak akses pentadbir.'); }
        finally { setSaving(false); }
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
    const selectedSession = senaraiSesi.find(session => session.id === sesiDipilih);
    const attendanceLoading = Boolean(sesiDipilih) && attendanceSession !== sesiDipilih;
    const filteredAttendance = filterAttendance(visibleAttendance, search);
    const hasSearch = Boolean(search.trim());

    const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] disabled:cursor-not-allowed disabled:opacity-40';
    const modules = [
        { href: '/admin/imbas', label: 'Imbas QR', icon: ScanLine },
        { href: '/admin/tentatif', label: 'Urus tentatif', icon: ListOrdered },
        { href: '/admin/cabutan', label: 'Cabutan bertuah', icon: Gift },
        { href: '/tayangan', label: 'Skrin projektor', icon: Tv },
    ];

    return (
        <div className="min-h-[calc(100svh-8rem)] px-4 py-7 text-[#003053] sm:px-6 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-7xl space-y-7">
                <header className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-slate-500">Ruang penganjur JPAEvents</p>
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Acara saya</h1>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Urus acara, semak kehadiran dan sediakan pasport peserta.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/admin/sesi-baru" className={actionClass + ' bg-[#003053] text-white hover:bg-[#164866]'}><PlusCircle className="size-4" /> Cipta acara</Link>
                        <button type="button" disabled={saving} onClick={handleLogKeluar} className={actionClass + ' border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700'}><LogOut className="size-4" /><span className="sr-only sm:not-sr-only">Log keluar</span></button>
                    </div>
                </header>

                <nav aria-label="Modul pentadbiran" className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
                    {modules.map(({ href, label, icon: Icon }) => <Link key={href} href={sesiDipilih ? `${href}?event=${encodeURIComponent(sesiDipilih)}` : '/admin/sesi-baru'} className="group flex min-h-14 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold transition-colors hover:border-[#b69a60] hover:bg-[#faf8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] sm:px-4 sm:text-sm"><Icon className="size-4 shrink-0 text-[#87703f]" />{label}<ArrowUpRight className="ml-auto size-4 shrink-0 text-slate-400 group-hover:text-[#003053]" /></Link>)}
                </nav>

                {(error || sessionError || attendanceError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || sessionError || attendanceError}</p>}

                <section aria-label="Ringkasan sesi" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <label htmlFor="admin-session" className="flex items-center gap-2 text-sm font-semibold"><Calendar className="size-4 text-slate-500" /> Acara</label>
                            {selectedSession && <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ' + (selectedSession.status_aktif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}><span className={'size-1.5 rounded-full ' + (selectedSession.status_aktif ? 'bg-emerald-600' : 'bg-slate-400')} />{selectedSession.status_aktif ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}</span>}
                        </div>
                        <select id="admin-session" value={sesiDipilih} disabled={loading || saving || !senaraiSesi.length}
                            onChange={event => { setSesiDipilih(event.target.value); setSearch(''); setCopyFeedback(null); }}
                            className="min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003053] disabled:opacity-50">
                            {!senaraiSesi.length && <option value="">{loading ? 'Memuatkan sesi…' : 'Tiada sesi tersedia'}</option>}
                            {senaraiSesi.map(session => <option key={session.id} value={session.id}>{session.tajuk} ({session.kod_sesi})</option>)}
                        </select>
                        {selectedSession && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5"><Calendar className="size-3.5" />{formatDate(selectedSession.tarikh)}</span>
                            <span className="flex items-center gap-1.5"><Clock className="size-3.5" />{formatTime(selectedSession.masa_mula)}</span>
                            <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{selectedSession.lokasi}</span>
                        </div>}
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                            {selectedSession && <><Link className={actionClass + ' border border-slate-200'} href={`/admin/events/${selectedSession.id}`}>Butiran & tema</Link>{selectedSession.published && <Link className={actionClass + ' border border-slate-200'} href={`/events/${encodeURIComponent(selectedSession.slug || '')}`}>Halaman & pautan acara</Link>}</>}
                            <button type="button" disabled={saving || loading || !sesiDipilih || !selectedSession?.published || selectedSession?.status_aktif} onClick={() => handleSetActive(true)} className={actionClass + ' bg-[#003053] text-white hover:bg-[#164866]'}>Buka pendaftaran</button>
                            <button type="button" disabled={saving || loading || !selectedSession?.status_aktif} onClick={() => handleSetActive(false)} className={actionClass + ' border border-slate-200 hover:bg-slate-50'}>Tutup pendaftaran</button>
                        </div>
                    </div>
                    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#003053] p-6 text-white">
                        <div className="absolute inset-x-0 top-0 h-1 bg-[#c7a052]" />
                        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-slate-200">Peserta berdaftar</h2><Users className="size-5 text-[#f4d891]" /></div>
                        <div className="my-5"><p className="text-5xl font-semibold tracking-tight tabular-nums">{loading || attendanceLoading || attendanceError || !sesiDipilih ? '—' : visibleAttendance.length}</p><p className="mt-2 text-xs text-slate-300">{selectedSession ? 'Kehadiran bagi sesi ' + selectedSession.kod_sesi : 'Pilih sesi untuk melihat kehadiran'}</p></div>
                        <div className="flex items-center gap-2 border-t border-white/15 pt-4 text-xs text-slate-200"><RefreshCw className="size-3.5 text-[#f4d891]" />Dikemas kini setiap 10 saat</div>
                    </div>
                </section>

                <section aria-labelledby="attendance-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
        </div>
    );
}

