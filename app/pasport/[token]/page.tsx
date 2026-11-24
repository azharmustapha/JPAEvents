'use client';

import { PassportCard } from '@/components/passport-card';
import React, { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { passportToPng } from '@/lib/passport-image';
import { isPassportToken, forgetMissingPassport } from '@/lib/attendance';
import { eventPath } from '@/lib/events';
import type { PassportData } from '@/types/database';
import {
    ArrowLeft,
    Loader2,
    Share2,
    Download,
    FileDown,
    ArrowRight
} from 'lucide-react';

export default function PasportPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const token = resolvedParams.token;

    const [data, setData] = useState<PassportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [retryAttempt, setRetryAttempt] = useState(0);
    const [actionError, setActionError] = useState('');
    const [savingImage, setSavingImage] = useState(false);
    const [savingPdf, setSavingPdf] = useState(false);
    const [copied, setCopied] = useState(false);

    const passportCardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        async function muatTurunPasport() {
            try {
                setLoading(true);
                setData(null);
                setErrorMsg('');
                setNotFound(false);
                if (!isPassportToken(token)) {
                    setNotFound(true);
                    setErrorMsg('Format pautan pasport tidak sah. Semak pautan yang diterima selepas pendaftaran.');
                    return;
                }
                const response = await getBrowserSupabase().rpc('get_passport', { passport_token: token });
                const { data: rekod, error } = response;
                if (cancelled) return;
                if (error) {
                    setErrorMsg('Maklumat pasport tidak dapat dimuatkan. Sila cuba lagi.');
                } else if (rekod === null) {
                    setNotFound(true);
                    setErrorMsg('Pautan ini tidak sepadan dengan rekod pasport semasa. Gunakan pautan yang diterima selepas pendaftaran terkini atau hubungi urus setia.');
                    try {
                        if (forgetMissingPassport(localStorage, token, response)) window.dispatchEvent(new Event('storage'));
                    } catch { /* Storage may be disabled; the registration link remains available. */ }
                } else if (!rekod || rekod.token_pasport !== token || !rekod.perhimpunan) {
                    setErrorMsg('Respons pasport tidak lengkap. Sila cuba lagi atau hubungi urus setia.');
                } else {
                    setData(rekod as PassportData);
                }
            } catch {
                if (!cancelled) setErrorMsg('Pasport digital tidak sah atau tidak dapat dimuatkan.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void muatTurunPasport();
        return () => { cancelled = true; };
    }, [token, retryAttempt]);

    const handleSimpanKeGaleri = async () => {
        if (!passportCardRef.current || !data || savingImage || savingPdf) return;
        try {
            setSavingImage(true);
            setActionError('');
            const dataUrl = await passportToPng(passportCardRef.current);

            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], `Pasport-JPAEvents-${data.nama_pegawai.replace(/\s+/g, '_')}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Pasport Digital JPAEvents',
                    text: `Pasport Kehadiran - ${data.nama_pegawai}`,
                });
            } else {
                const pautan = document.createElement('a');
                pautan.download = file.name;
                pautan.href = dataUrl;
                pautan.click();
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError('Imej tidak dapat disimpan. Sila cuba lagi.');
        } finally {
            setSavingImage(false);
        }
    };

    const handleSimpanPdf = async () => {
        if (!passportCardRef.current || !data || savingImage || savingPdf) return;
        try {
            setSavingPdf(true);
            setActionError('');
            const { downloadPassportPdf } = await import('@/lib/passport-pdf');
            await downloadPassportPdf(passportCardRef.current, data.nama_pegawai);
        } catch {
            setActionError('PDF tidak dapat disimpan. Sila cuba lagi.');
        } finally {
            setSavingPdf(false);
        }
    };

    const handleKongsi = async () => {
        setActionError('');
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Pasport Digital JPAEvents', url: window.location.href });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError('Pautan tidak dapat dikongsi. Sila cuba lagi.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100svh-8rem)] bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#003053]" />
                <p className="text-sm font-bold tracking-tight">Menyediakan Pasport...</p>
            </div>
        );
    }

    if (errorMsg || !data) {
        return (
            <div className="min-h-[calc(100svh-8rem)] bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-xl font-bold text-[#003053] mb-2">{notFound ? 'Pasport Tidak Ditemui' : 'Pasport Belum Dapat Dimuatkan'}</h1>
                <p role="alert" className="text-sm text-slate-500 max-w-xs mb-8">{errorMsg}</p>
                {!notFound && <button type="button" onClick={() => setRetryAttempt(value => value + 1)} className="primary-action mb-4">Cuba Lagi</button>}
                <Link href="/daftar" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#003053] text-white text-sm font-bold hover:bg-[#003053]/90 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Kembali ke Pendaftaran</span>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100svh-8rem)] bg-slate-50 flex flex-col items-center p-4 py-8 font-sans selection:bg-slate-200">
            <div className="w-full max-w-md">

                {/* Bar Navigasi Atas */}
                <div className="flex items-center justify-between mb-6 px-2">
                    <Link href={data?.perhimpunan.slug ? eventPath(data.perhimpunan.slug) : '/'} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-[#003053] transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span>Utama</span>
                    </Link>
                    <button
                        onClick={handleKongsi}
                        className="flex items-center gap-1.5 text-xs font-bold bg-white shadow-sm border border-slate-200 px-4 py-2 rounded-full text-[#003053] hover:bg-slate-50 transition-colors"
                    >
                        <Share2 className="w-4 h-4" />
                        <span>{copied ? 'Disalin!' : 'Kongsi'}</span>
                    </button>
                </div>

                {/* KAD PASPORT (Bahagian yang akan di-export sebagai imej) */}
                <div className="mb-8"><PassportCard data={data} cardRef={passportCardRef} /></div>

                {/* Butang Tindakan */}
                <div className="space-y-3">
                    <button
                        onClick={handleSimpanKeGaleri}
                        disabled={savingImage || savingPdf}
                        className="primary-action w-full disabled:opacity-50"
                    >
                        {savingImage ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /><span>Menyimpan Imej...</span></>
                        ) : (
                            <><Download className="w-4 h-4" /><span>Simpan sebagai PNG</span></>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleSimpanPdf}
                        disabled={savingImage || savingPdf}
                        className="primary-action w-full disabled:opacity-50"
                    >
                        {savingPdf ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /><span>Menyimpan PDF...</span></>
                        ) : (
                            <><FileDown className="w-4 h-4" /><span>Simpan sebagai PDF</span></>
                        )}
                    </button>
                    <p className="text-center text-xs text-slate-500">Pilih PDF untuk klik kod QR selepas dimuat turun. Kod QR dalam PNG boleh diimbas.</p>

                    {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}

                    <div className="pt-4 flex justify-center">
                        <Link
                            href={data?.perhimpunan.slug ? eventPath(data.perhimpunan.slug, 'atur-cara') : '/'}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#003053] transition-colors"
                        >
                            <span>Lihat Tentatif Majlis</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
