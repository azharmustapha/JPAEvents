/* eslint-disable @next/next/no-img-element */
import type { Ref } from 'react';
import { safeEventAsset } from '@/lib/event-assets';
import { BrandLogo } from '@/components/brand-logo';
import { EventTheme } from '@/components/event-theme';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { passportNumber } from '@/lib/attendance';
import { formatDate, formatTime } from '@/lib/date';
import type { PassportData } from '@/types/database';


export function PassportCard({ data, cardRef }: { data: PassportData; cardRef?: Ref<HTMLDivElement> }) {
    const waktuFormat = formatTime(data.waktu_hadir, false, data.perhimpunan.timezone);
    const tarikhFormat = formatDate(data.perhimpunan.tarikh);
    const banner = safeEventAsset(data.perhimpunan.banner_url);
    return (
        <div
            ref={cardRef}
            className="boarding-pass-card overflow-hidden"
            style={{ borderTop: `6px solid ${data.perhimpunan.primary_color || '#003053'}` }}
        >
            {banner && <div data-passport-theme><img src={banner} alt="Banner acara" className="event-banner passport-banner" crossOrigin="anonymous" /></div>}
            <div className="p-5 sm:p-8">
                {/* Header Kad */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div data-passport-logo className="h-12 w-12 shrink-0 rounded-xl bg-white">
                            <BrandLogo src={safeEventAsset(data.perhimpunan.logo_url) || '/jpaevents.svg'} alt="Logo acara" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Pas digital</div>
                            <div className="text-sm font-bold text-[#003053]">{data.perhimpunan.organizer_name || 'JPAEvents'}</div>
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{data.checked_in_at ? 'DAFTAR HADIR DISAHKAN' : 'PENDAFTARAN DISAHKAN'}</span>
                    </div>
                </div>

                <div className="passport-number-panel"><span>No. Pasport </span><strong>{passportNumber(data.no_pasport)}</strong></div>
                <div className="mb-6 border-b border-slate-200 pb-5">
                    <p className="flight-code mb-2">{data.perhimpunan.kod_sesi}</p>
                    <h1 className="text-base font-semibold leading-snug text-[#003053]">{data.perhimpunan.tajuk}</h1>
                    <EventTheme tema={data.perhimpunan.tema} />
                </div>
                {/* Nama & Bahagian */}
                <div className="space-y-2 mb-8">
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">Nama Peserta</div>
                        <div className="text-2xl font-bold text-[#003053] uppercase leading-none break-words">
                            {data.nama_pegawai}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">
                            {data.bahagian_unit}
                        </div>
                    </div>
                </div>

                {/* Garisan Pemisah Bertiket */}
                <div className="relative flex items-center justify-center my-6">
                    <div className="absolute -left-10 h-6 w-6 rounded-full bg-slate-50 border-r border-slate-100"></div>
                    <div className="w-full border-t-[2px] border-dashed border-slate-200"></div>
                    <div className="absolute -right-10 h-6 w-6 rounded-full bg-slate-50 border-l border-slate-100"></div>
                </div>

                {/* Butiran Sesi & Masa */}
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" /> Tarikh
                        </div>
                        <div className="text-sm font-bold text-[#003053]">{tarikhFormat}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Waktu Daftar
                        </div>
                        <div className="text-sm font-bold text-[#003053]">{waktuFormat}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" /> Lokasi
                        </div>
                        <div className="text-sm font-bold text-[#003053]">{data.perhimpunan.lokasi}</div>
                    </div>
                </div>

                {/* Kod QR */}
                <div className="mt-8 flex flex-col items-center justify-center">
                    <a
                        data-passport-qr-link
                        href={`/pasport/${encodeURIComponent(data.token_pasport)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Buka pas digital anda"
                        className="block p-1 rounded-2xl bg-white border border-slate-100 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#003053]"
                    >
                        <QRCodeSVG value={data.token_pasport} size={160} level="H" includeMargin={true} />
                    </a>
                    <div className="mt-3 font-mono text-[11px] font-bold text-slate-500 tracking-[0.2em]">
                        Kod pengesahan peserta
                    </div>
                    <p className="mt-1 text-xs text-slate-500">imbas atau klik</p>
                </div>
            </div>
        </div>
    );
}
