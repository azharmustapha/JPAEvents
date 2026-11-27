'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useOrganizer } from '@/components/organizer-provider';
import { organizerHref } from '@/lib/organizer-navigation';
import { loadAdminSessions } from '@/lib/admin-data';
import { parseScannedPassport } from '@/lib/events';
import { passportNumber } from '@/lib/attendance';
import { formatTime } from '@/lib/date';
import {
    ArrowLeft,
    ScanLine,
    CheckCircle2,
    XCircle,
    RefreshCcw
} from '@/components/ui-icons';

interface InfoPeserta {
    nama_pegawai: string;
    bahagian_unit: string;
    waktu_hadir: string;
    token_pasport: string;
    no_pasport?: number;
    checked_in_at?: string;
    timezone?: string;
}

export default function LamanImbasQR() {
    const { event } = useOrganizer();
    const eventId = event?.id;
    const [hasilImbasan, setHasilImbasan] = useState<string | null>(null);
    const [dataPeserta, setDataPeserta] = useState<InfoPeserta | null>(null);
    const [statusSemakan, setStatusSemakan] = useState<'menunggu' | 'sah' | 'tidak_sah'>('menunggu');
    const [loading, setLoading] = useState(false);
    const [scanError, setScanError] = useState('');

    useEffect(() => {
        if (statusSemakan === 'menunggu' && eventId) {
            let disposed = false;
            let scanned = false;
            let cleared = false;
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            async function clearScanner() {
                if (cleared) return;
                cleared = true;
                await scanner.clear().catch(() => {});
            }
            scanner.render(
                async (decodedText) => {
                    if (disposed || scanned) return;
                    scanned = true;
                    setHasilImbasan(decodedText);
                    setLoading(true);
                    await clearScanner();
                    if (disposed) return;
                    try {
                        const token = parseScannedPassport(decodedText, window.location.origin);
                        if (!token) {
                            setStatusSemakan('tidak_sah');
                            return;
                        }
                        const client = getBrowserSupabase();
                        const event = (await loadAdminSessions(client)).find(item => item.id === eventId);
                        if (disposed) return;
                        if (!event) {
                            if (!disposed) { setScanError('Tiada sesi aktif untuk pengesahan.'); setStatusSemakan('tidak_sah'); }
                            return;
                        }
                        const { data, error } = await client.rpc('check_in_attendee', { event_id: event.id, passport_token: token });
                        if (error) throw error;
                        if (disposed) return;
                        if (!data) {
                            setStatusSemakan('tidak_sah');
                        } else {
                            setDataPeserta({ ...data, timezone: event.timezone } as InfoPeserta);
                            setStatusSemakan('sah');
                        }
                    } catch {
                        if (!disposed) { setScanError('Semakan tidak dapat dilakukan. Semak sambungan dan akses pentadbir.'); setStatusSemakan('tidak_sah'); }
                    } finally { if (!disposed) setLoading(false); }
                },
                () => {}
            );

            return () => {
                disposed = true;
                void clearScanner();
            };
        }
    }, [statusSemakan, eventId]);

    const resetImbasan = () => {
        setScanError('');
        setHasilImbasan(null);
        setDataPeserta(null);
        setStatusSemakan('menunggu');
    };

    return (
        <div className="organizer-scanner text-slate-900 font-sans flex flex-col">
            <div className="max-w-md mx-auto w-full flex-1 flex flex-col">

                {/* Header Navigasi */}
                <div className="flex items-center justify-between mb-8">
                    <Link href={organizerHref('/admin', eventId || null)} aria-label="Kembali ke Acara saya" className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm">
                        <ArrowLeft className="w-5 h-5 text-[#003053]" />
                    </Link>
                    <div className="inline-flex items-center gap-1.5 bg-[#003053] text-white px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase shadow-md">
                        <ScanLine className="w-4 h-4" />
                        <span>Pengesah QR</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">

                    {/* Keadaan 1: Menunggu Imbasan (Kamera Aktif) */}
                    {!eventId && <p role="status" className="workspace-loading">Pilih acara untuk mula mengimbas pas peserta.</p>}
                    {statusSemakan === 'menunggu' && eventId && (
                        <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-[0_20px_50px_rgb(0,0,0,0.05)] text-center">
                            <h2 className="text-xl font-bold text-[#003053] mb-2">Imbas QR peserta</h2>
                            <p className="text-sm font-medium text-slate-500 mb-6">Halakan kamera ke arah Kod QR pada telefon peserta.</p>

                            {/* Bekas Kamera html5-qrcode */}
                            <div id="reader" className="w-full overflow-hidden rounded-2xl border-2 border-slate-100 [&_video]:rounded-2xl [&_video]:object-cover mb-4"></div>
                        </div>
                    )}

                    {/* Keadaan 2 & 3: Sedang Memuatkan / Hasil Paparan */}
                    {statusSemakan !== 'menunggu' && (
                        <div className="rounded-2xl bg-white border border-slate-100 p-8 shadow-[0_20px_50px_rgb(0,0,0,0.08)] text-center relative overflow-hidden">

                            {loading ? (
                                <div className="py-12 flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-slate-200 border-t-black rounded-full animate-spin"></div>
                                    <span className="font-bold text-slate-500 tracking-wide uppercase text-sm">Menyemak Rekod...</span>
                                </div>
                            ) : statusSemakan === 'sah' && dataPeserta ? (
                                // Paparan Jika Pasport Sah
                                <div className="py-4 space-y-6">
                                    <div className="mx-auto w-20 h-20 bg-emerald-50 border-2 border-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                    </div>

                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-100 mb-4">
                                            Pasport Disahkan Tulen
                                        </div>
                                        <h3 className="text-2xl font-bold text-[#003053] uppercase leading-tight mb-2">
                                            {dataPeserta.nama_pegawai}
                                        </h3>
                                        <p className="text-sm font-bold text-slate-500">
                                            {dataPeserta.bahagian_unit}
                                        </p>
                                    </div>

                                    <div className="pt-6 border-t border-slate-100">
                                        <div className="grid grid-cols-2 gap-4 text-left">
                                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">No. Pasport</span>
                                                <span className="font-mono text-xs font-bold text-[#003053]">{passportNumber(dataPeserta.no_pasport)}</span>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Waktu Masuk</span>
                                                <span className="text-xs font-bold text-[#003053]">
                                                    {formatTime(dataPeserta.checked_in_at || dataPeserta.waktu_hadir, false, dataPeserta.timezone)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Paparan Jika Pasport Tidak Sah / Palsu
                                <div className="py-8 space-y-4">
                                    <div className="mx-auto w-20 h-20 bg-red-50 border-2 border-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <XCircle className="w-10 h-10 text-red-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-[#003053]">TIDAK SAH</h3>
                                    <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto">
                                        {scanError || 'Kod QR ini tidak wujud dalam pangkalan data sesi acara semasa.'}
                                    </p>
                                    <div className="font-mono text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mt-4 mx-auto w-max">
                                        KOD: {hasilImbasan}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={resetImbasan}
                                disabled={loading}
                                className="w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-full bg-[#003053] text-white text-sm font-bold shadow-lg hover:bg-[#003053]/90 transition-colors disabled:opacity-50"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                <span>Imbas Pasport Seterusnya</span>
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
