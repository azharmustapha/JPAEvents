'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { Acara, KehadiranPeserta, CabutanPemenang } from '@/types/database';
import { passportNumber } from '@/lib/attendance';
import { createDrawId, getEligibleDrawParticipants } from '@/lib/cabutan';
import { loadAttendance, loadCabutanWinners, loadAdminSessions } from '@/lib/admin-data';
import './cabutan.css';
import {
    ArrowLeft,
    Maximize,
    Minimize,
    PanelRightClose,
    PanelRightOpen,
    CheckCircle2,
    Loader2,
    Plane,
    ShieldCheck,
    Sparkles,
    Ticket,
    Trophy,
    RotateCw,
    Users
} from 'lucide-react';

export default function CabutanBertuahPage() {
    const eventId = useSearchParams().get('event');
    const [senaraiPeserta, setSenaraiPeserta] = useState<KehadiranPeserta[]>([]);
    const [sesiAktif, setSesiAktif] = useState<Acara | null>(null);
    const [pemenangSemasa, setPemenangSemasa] = useState<CabutanPemenang | null>(null);
    const [senaraiPemenang, setSenaraiPemenang] = useState<CabutanPemenang[]>([]);
    const [sedangMuat, setSedangMuat] = useState(true);
    const [sedangPusing, setSedangPusing] = useState(false);
    const [sedangSimpan, setSedangSimpan] = useState(false);
    const [cabutanTertunda, setCabutanTertunda] = useState<{ id: string; peserta: KehadiranPeserta } | null>(null);
    const [ralatSimpan, setRalatSimpan] = useState('');
    const [celebrationId, setCelebrationId] = useState<string | null>(null);
    const [paparanRawak, setPaparanRawak] = useState<string>('MENUNGGU CABUTAN');
    const [error, setError] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [fullscreenError, setFullscreenError] = useState('');
    const screenRef = useRef<HTMLElement>(null);
    const drawTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const saveBusy = useRef(false);
    const mounted = useRef(false);

    useEffect(() => {
        const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === screenRef.current);
        document.addEventListener('fullscreenchange', updateFullscreen);
        return () => document.removeEventListener('fullscreenchange', updateFullscreen);
    }, []);

    async function toggleFullscreen() {
        setFullscreenError('');
        try {
            if (document.fullscreenElement === screenRef.current) {
                await document.exitFullscreen();
            } else {
                if (!screenRef.current?.requestFullscreen) throw new Error('Fullscreen unavailable');
                await screenRef.current.requestFullscreen();
            }
        } catch {
            setFullscreenError('Skrin penuh tidak tersedia. Gunakan pilihan skrin penuh pada pelayar anda.');
        }
    }

    useEffect(() => {
        let cancelled = false;
        mounted.current = true;
        async function muatPeserta() {
            try {
                const client = getBrowserSupabase();
                const sesi = (await loadAdminSessions(client)).find(event => event.id === eventId);
                if (cancelled) return;
                if (sesi) {
                    const [peserta, pemenang] = await Promise.all([
                        loadAttendance(client, sesi.id), loadCabutanWinners(client, sesi.id),
                    ]);
                    if (cancelled) return;
                    setSesiAktif(sesi as Acara);
                    setSenaraiPeserta(peserta);
                    setSenaraiPemenang(pemenang);
                    setPemenangSemasa(pemenang[0] ?? null);
                } else setError('Tiada sesi aktif.');
            } catch { if (!cancelled) setError('Senarai peserta dan sejarah pemenang tidak dapat dimuatkan. Muat semula halaman atau semak akses pentadbir.'); }
            finally { if (!cancelled) setSedangMuat(false); }
        }
        void muatPeserta();
        return () => {
            cancelled = true;
            mounted.current = false;
            if (drawTimer.current) clearInterval(drawTimer.current);
            drawTimer.current = null;
        };
    }, [eventId]);

    useEffect(() => {
        if (!celebrationId) return;
        const timer = setTimeout(() => setCelebrationId(null), 3500);
        return () => clearTimeout(timer);
    }, [celebrationId]);

    const nomborBelumTersedia = senaraiPeserta.some(p => passportNumber(p.no_pasport) === '—');
    const calonLayak = getEligibleDrawParticipants(senaraiPeserta, senaraiPemenang, sesiAktif?.draw_exclude_first ?? 0);
    const pemenangPaparan = cabutanTertunda?.peserta ?? pemenangSemasa;

    const simpanPemenang = async (cabutan: { id: string; peserta: KehadiranPeserta }) => {
        if (!sesiAktif || saveBusy.current) return;
        saveBusy.current = true;
        setSedangSimpan(true);
        setRalatSimpan('');
        try {
            const client = getBrowserSupabase();
            const { data, error: saveError } = await client.rpc('save_cabutan_winner', {
                draw_id: cabutan.id, event_id: sesiAktif.id, participant_id: cabutan.peserta.id,
            });
            if (saveError?.code === '23505') {
                const pemenang = await loadCabutanWinners(client, sesiAktif.id);
                if (!mounted.current) return;
                setSenaraiPemenang(pemenang);
                setPemenangSemasa(pemenang[0] ?? null);
                setCabutanTertunda(null);
                setRalatSimpan('Peserta ini telah menang pada cabutan lain. Sejarah telah dikemas kini; sila cabut semula.');
                return;
            }
            if (saveError) throw saveError;
            if (!data) throw new Error('Tiada rekod pemenang diterima.');
            if (!mounted.current) return;
            const pemenang = data as CabutanPemenang;
            setPemenangSemasa(pemenang);
            setSenaraiPemenang(prev => [pemenang, ...prev.filter(p => p.id !== pemenang.id)]);
            setCabutanTertunda(null);
            setCelebrationId(pemenang.id);
        } catch {
            if (mounted.current) setRalatSimpan('Pemenang belum dapat disahkan sebagai tersimpan. Cuba simpan semula; peserta yang sama akan dikekalkan.');
        } finally {
            saveBusy.current = false;
            if (mounted.current) setSedangSimpan(false);
        }
    };

    const mulakanCabutan = () => {
        if (drawTimer.current || sedangMuat || sedangPusing || saveBusy.current || cabutanTertunda || error || !sesiAktif) return;
        if (nomborBelumTersedia) return;
        if (calonLayak.length === 0) return;

        const drawId = createDrawId();
        setSedangPusing(true);
        setRalatSimpan('');
        setCelebrationId(null);
        let counter = 0;
        const durasi = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 35;

        const interval = setInterval(() => {
            const indeksRawak = Math.floor(Math.random() * calonLayak.length);
            setPaparanRawak(passportNumber(calonLayak[indeksRawak].no_pasport));
            counter++;

            if (counter >= durasi) {
                clearInterval(interval);
                drawTimer.current = null;
                const pemenangTerpilih = calonLayak[Math.floor(Math.random() * calonLayak.length)];
                const cabutan = { id: drawId, peserta: pemenangTerpilih };
                setCabutanTertunda(cabutan);
                setSedangPusing(false);
                void simpanPemenang(cabutan);
            }
        }, 70);
        drawTimer.current = interval;
    };

    const sudahMenang = !!pemenangSemasa && !sedangPusing && !cabutanTertunda;
    const habisCalon = !sedangMuat && calonLayak.length === 0;
    const statusCabutan = sedangMuat ? 'Memuatkan cabutan' : error || nomborBelumTersedia ? 'Cabutan tidak tersedia' : sedangPusing ? 'Sedang mencabut' : sedangSimpan ? 'Menyimpan pemenang' : cabutanTertunda ? 'Simpanan belum disahkan' : habisCalon ? 'Tiada calon layak' : sudahMenang ? 'Pemenang tersimpan' : 'Sedia untuk cabutan';
    const nomborPaparan = sedangPusing ? paparanRawak : pemenangPaparan ? passportNumber(pemenangPaparan.no_pasport) : '———';
    const digitPaparan = nomborPaparan === 'MENUNGGU CABUTAN' ? ['—', '—', '—'] : nomborPaparan.padStart(3, '0').split('');
    const nomborCabutan = sedangPusing || cabutanTertunda ? senaraiPemenang.length + 1 : Math.max(1, senaraiPemenang.length);
    const tajukPentas = sedangMuat ? 'Sila tunggu sebentar' : error ? 'Cabutan belum tersedia' : nomborBelumTersedia ? 'Semak nombor pasport' : sedangPusing ? 'Siapa yang bertuah?' : sedangSimpan ? 'Menyimpan pilihan ini…' : cabutanTertunda ? 'Pilihan anda dikekalkan' : sudahMenang ? 'Tahniah, anda bertuah!' : habisCalon ? 'Tiada peserta yang layak' : 'Giliran siapa seterusnya?';
    const teksButang = sedangMuat ? 'Memuatkan…' : error || nomborBelumTersedia ? 'Cabutan tidak tersedia' : sedangPusing ? 'Sedang mencabut…' : sedangSimpan ? 'Menyimpan…' : cabutanTertunda ? 'Cuba simpan semula' : habisCalon ? 'Tiada calon layak' : sudahMenang ? 'Cabut pemenang seterusnya' : 'Mulakan cabutan';

    return (
        <main ref={screenRef} className={`cabutan-page${showHistory ? ' has-history' : ''}`}>
            <div className="cabutan-toolbar">
                <Link href="/admin" className="cabutan-back"><ArrowLeft aria-hidden="true" /><span>Kembali ke admin</span></Link>
                <span className="cabutan-airline"><Plane aria-hidden="true" />JPAEvents</span>
                <div className="cabutan-view-controls">
                    <button type="button" onClick={() => setShowHistory(value => !value)} aria-label={showHistory ? 'Sembunyikan pemenang' : 'Senarai pemenang'} aria-expanded={showHistory} aria-controls="cabutan-history" className="cabutan-view-button">
                        {showHistory ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}<span>{showHistory ? 'Sembunyikan pemenang' : 'Senarai pemenang'}</span>
                    </button>
                    <button type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen} className="cabutan-view-button" title={isFullscreen ? 'Keluar skrin penuh (Esc)' : 'Buka skrin penuh'}>
                        {isFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}<span>{isFullscreen ? 'Keluar skrin penuh' : 'Skrin penuh'}</span>
                    </button>
                </div>
            </div>

            <header className="cabutan-header">
                <div>
                    <h1>Cabutan Bertuah</h1>
                    <p>{sesiAktif?.tajuk || 'Acara JPAEvents'}</p>
                </div>
                <dl className="cabutan-stats">
                    <div><dt><Users aria-hidden="true" />Jumlah peserta</dt><dd>{sedangMuat || error ? '—' : senaraiPeserta.length}</dd></div>
                    <div className="cabutan-stat-eligible"><dt><Ticket aria-hidden="true" />Masih layak</dt><dd>{sedangMuat || error ? '—' : calonLayak.length}</dd></div>
                    <div><dt><Trophy aria-hidden="true" />Pemenang</dt><dd>{sedangMuat || error ? '—' : senaraiPemenang.length}</dd></div>
                </dl>
            </header>

            {(error || ralatSimpan || nomborBelumTersedia || fullscreenError) && (
                <div className="cabutan-alert" role="alert">
                    {fullscreenError && <p>{fullscreenError}</p>}
                    {error && <p>{error}</p>}
                    {ralatSimpan && <p>{ralatSimpan}</p>}
                    {nomborBelumTersedia && <p>Nombor pasport belum tersedia. Jalankan migrasi nombor pasport sebelum cabutan.</p>}
                </div>
            )}

            <div className="cabutan-layout">
                <section className={`cabutan-stage${sedangPusing ? ' is-spinning' : ''}${celebrationId ? ' is-celebrating' : ''}`} aria-labelledby="cabutan-stage-title">
                    {celebrationId && (
                        <div key={celebrationId} className="cabutan-confetti" aria-hidden="true">
                            {Array.from({ length: 28 }, (_, index) => (
                                <i key={index} style={{
                                    '--piece-x': `${(index * 37) % 100}%`,
                                    '--piece-delay': `${(index % 7) * 0.07}s`,
                                    '--piece-turn': `${(index % 2 ? 1 : -1) * (180 + index * 19)}deg`,
                                } as React.CSSProperties} />
                            ))}
                        </div>
                    )}
                    <div className="cabutan-stage-meta">
                        <span><Ticket aria-hidden="true" />Cabutan <strong>#{nomborCabutan}</strong></span>
                        <span className={`cabutan-status${sudahMenang ? ' is-saved' : ''}`}><span aria-hidden="true" />{statusCabutan}</span>
                    </div>

                    <div className="cabutan-stage-body">
                        <div className="cabutan-stage-heading"><Trophy aria-hidden="true" /><h2 id="cabutan-stage-title">{tajukPentas}</h2></div>
                        <p className="cabutan-passport-label">No. pasport</p>
                        <div className="cabutan-digits" aria-label={sedangPusing ? 'Nombor pasport sedang dicabut' : pemenangPaparan ? `Nombor pasport ${nomborPaparan}` : 'Menunggu cabutan'} style={{ '--digit-count': Math.max(3, digitPaparan.length) } as React.CSSProperties}>
                            {digitPaparan.map((digit, index) => <span key={index} className="cabutan-digit" aria-hidden="true"><span>{digit}</span></span>)}
                        </div>
                        <div className={`cabutan-winner${pemenangPaparan && !sedangPusing ? ' has-winner' : ''}`}>
                            {pemenangPaparan && !sedangPusing ? (
                                <><span className="cabutan-winner-label">{cabutanTertunda ? 'Menunggu pengesahan simpanan' : 'Pemenang terkini'}</span><h3>{pemenangPaparan.nama_pegawai}</h3><p>{pemenangPaparan.bahagian_unit}</p></>
                            ) : (
                                <p className="cabutan-stage-hint">{sedangMuat ? 'Memuatkan peserta dan sejarah pemenang…' : sedangPusing ? 'Nombor bertuah anda mungkin muncul sebentar lagi.' : error ? 'Muat semula halaman untuk mencuba lagi.' : nomborBelumTersedia ? 'Nombor pasport diperlukan sebelum cabutan boleh dimulakan.' : habisCalon ? senaraiPeserta.length === 0 ? 'Belum ada peserta berdaftar. Muat semula selepas peserta mendaftar.' : 'Tiada calon yang masih layak. Muat semula selepas peserta baharu mendaftar.' : 'Tekan butang di bawah untuk memilih seorang pemenang.'}</p>
                            )}
                        </div>
                    </div>

                    <div className="cabutan-stage-controls">
                        <button type="button" onClick={() => cabutanTertunda ? void simpanPemenang(cabutanTertunda) : mulakanCabutan()}
                            disabled={sedangMuat || sedangPusing || sedangSimpan || (!cabutanTertunda && calonLayak.length === 0) || nomborBelumTersedia || !!error}
                            aria-describedby="cabutan-remaining"
                            className="cabutan-draw-button">
                            {sedangMuat || sedangSimpan ? <Loader2 className="cabutan-spinner" aria-hidden="true" /> : sedangPusing ? <RotateCw className="cabutan-spinner" aria-hidden="true" /> : cabutanTertunda ? <RotateCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                            {teksButang}
                        </button>
                        <p id="cabutan-remaining" className="cabutan-remaining">{sedangMuat ? 'Menyemak kelayakan peserta…' : error ? 'Senarai calon belum tersedia' : cabutanTertunda ? 'Sahkan simpanan sebelum cabutan seterusnya' : habisCalon ? 'Tiada calon layak untuk cabutan seterusnya' : `${calonLayak.length} calon layak untuk cabutan seterusnya`}</p>
                        <p><ShieldCheck aria-hidden="true" />Pemenang disimpan secara automatik</p>
                    </div>
                </section>

                <aside id="cabutan-history" className="cabutan-history" aria-labelledby="cabutan-history-title" hidden={!showHistory}>
                    <header className="cabutan-history-header"><div><Trophy aria-hidden="true" /><h2 id="cabutan-history-title">Senarai pemenang</h2></div><span>{senaraiPemenang.length}</span></header>
                    <p className="cabutan-history-intro">Cabutan terkini dipaparkan dahulu.</p>
                    {sedangMuat ? <div className="cabutan-history-empty"><Loader2 className="cabutan-spinner" aria-hidden="true" /><p>Memuatkan sejarah…</p></div>
                        : senaraiPemenang.length > 0 ? (
                            <ol className="cabutan-history-list" tabIndex={0} aria-label="Pemenang mengikut cabutan terkini">
                                {senaraiPemenang.map((p, index) => (
                                    <li key={p.id} className={index === 0 ? 'is-latest' : undefined}>
                                        <span className="cabutan-history-rank">{String(senaraiPemenang.length - index).padStart(2, '0')}</span>
                                        <div className="cabutan-history-person"><div><span className="cabutan-history-passport">No. {passportNumber(p.no_pasport)}</span>{index === 0 && <span className="cabutan-latest-label">Terkini</span>}</div><h3>{p.nama_pegawai}</h3><p>{p.bahagian_unit}</p></div>
                                    </li>
                                ))}
                            </ol>
                        ) : <div className="cabutan-history-empty"><Ticket aria-hidden="true" /><h3>{error ? 'Sejarah belum tersedia' : 'Pemenang pertama menanti'}</h3><p>{error ? 'Muat semula halaman untuk menyemak sejarah.' : 'Nama pemenang akan muncul di sini selepas cabutan.'}</p></div>}
                    <div className="cabutan-history-note"><CheckCircle2 aria-hidden="true" /><p>Sejarah kekal apabila halaman dibuka semula. Pemenang terdahulu dikecualikan.</p></div>
                </aside>
            </div>
            <footer className="cabutan-footer"><span>JPAEvents</span><span>JPAEvents</span></footer>
            <div className="cabutan-announcement" role="status" aria-live="polite" aria-atomic="true">{sudahMenang ? `Pemenang ${pemenangSemasa.nama_pegawai}, nombor pasport ${passportNumber(pemenangSemasa.no_pasport)}.` : statusCabutan}</div>
        </main>
    );
}
