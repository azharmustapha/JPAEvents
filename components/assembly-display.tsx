import { Calendar, Clock, Loader2, MapPin, Minimize, QrCode, ScanLine, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { CSSProperties, Ref } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { EventTheme } from '@/components/event-theme';
import { formatDate } from '@/lib/date';
import type { Acara } from '@/types/database';
import styles from './assembly-display.module.css';

type AssemblyDisplayProps = {
    event: Acara | null;
    count: number;
    loading: boolean;
    error: string | null;
    registrationUrl: string;
    clock: string;
    controlError: string;
    onExit: () => void;
    exitButtonRef: Ref<HTMLButtonElement>;
};

const countFormatter = new Intl.NumberFormat('ms-MY');

export function AssemblyDisplay({
    event, count, loading, error, registrationUrl, clock, controlError, onExit, exitButtonRef,
}: AssemblyDisplayProps) {
    const active = Boolean(event) && !loading && !error;
    const status = loading ? 'Memuatkan sesi' : error ? 'Sambungan terganggu'
        : active ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup';
    const countText = active ? countFormatter.format(count) : '—';

    return (
        <div className={styles.display}>
            <header className={styles.header}>
                <div className={styles.brand}>
                    <BrandLogo />
                    <div>
                        <p>JPAEvents</p>
                        <span>Acara JPAEvents</span>
                    </div>
                </div>
                <div className={styles.controls}>
                    <div className={styles.clock}>
                        <Clock aria-hidden="true" />
                        <time aria-label="Waktu Malaysia">{clock || '--:--:--'}</time>
                    </div>
                    <button ref={exitButtonRef} type="button" onClick={onExit} className={styles.exit}
                        aria-label="Keluar skrin penuh" aria-pressed="true" title="Keluar skrin penuh (Esc)">
                        <Minimize aria-hidden="true" />
                        <span>Keluar</span><kbd>Esc</kbd>
                    </button>
                </div>
            </header>

            {controlError && <p role="alert" className={styles.notice}>{controlError}</p>}

            <main className={styles.main}>
                <section className={styles.event} aria-labelledby="display-event-title" aria-busy={loading}>
                    <div className={styles.eventInfo}>
                        <h1 id="display-event-title" title={event?.tajuk}>{loading ? 'Menyediakan paparan dewan…' : error
                            ? 'Maklumat sesi tidak dapat dimuatkan' : event?.tajuk || 'Menunggu acara seterusnya'}</h1>
                        {event && !error ? (
                            <div className={styles.details}>
                                <span><Calendar aria-hidden="true" />{formatDate(event.tarikh)}</span>
                                <span><MapPin aria-hidden="true" />{event.lokasi}</span>
                            </div>
                        ) : (
                            <p className={styles.eventMessage}>{error
                                ? 'Semak sambungan internet. Paparan akan mencuba semula secara automatik.'
                                : loading ? 'Maklumat sesi dan kehadiran sedang dimuatkan.'
                                    : 'Maklumat akan dipaparkan apabila urus setia membuka sesi.'}</p>
                        )}
                    </div>
                    {event && !error && <div className={styles.theme} title={event.tema || undefined}><EventTheme tema={event.tema} large /></div>}
                </section>

                <div className={styles.stage}>
                    <section className={styles.attendance} aria-labelledby="display-count-title" aria-busy={loading}>
                        <div className={styles.attendanceTop}>
                            <h2 id="display-count-title"><Users aria-hidden="true" />Peserta hadir</h2>
                            <span className={`${styles.status} ${active ? styles.active : ''}`}>
                                <span aria-hidden="true" />{status}
                            </span>
                        </div>
                        <div className={styles.countArea}>
                            <div role="status" aria-label="Bilangan peserta hadir" aria-atomic="true"
                                className={styles.count} style={{ '--count-length': Math.max(4, countText.length) } as CSSProperties}>
                                <span key={countText}>{countText}</span>
                            </div>
                            <p>{loading ? 'Mengira kehadiran…' : error ? 'Bilangan kehadiran belum tersedia'
                                : active ? 'Terima kasih atas kehadiran anda' : 'Tiada sesi aktif'}</p>
                        </div>
                        <div className={styles.attendanceBottom}>
                            <span>Kehadiran didaftarkan secara kendiri</span>
                            <span>Kemas kini setiap 10 saat</span>
                        </div>
                    </section>

                    <section className={styles.registration} aria-labelledby="display-qr-title" aria-busy={loading}>
                        <h2 id="display-qr-title"><ScanLine aria-hidden="true" />{active ? 'Imbas & daftar kehadiran'
                            : loading ? 'Menyediakan kod QR' : 'Kod QR belum tersedia'}</h2>
                        <div className={styles.qr}>
                            {active && registrationUrl ? (
                                <QRCodeSVG value={registrationUrl} size={640} level="M" marginSize={4}
                                    role="img" title="Kod QR pendaftaran kehadiran sesi aktif" />
                            ) : (
                                <div className={styles.qrPlaceholder}>
                                    {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <QrCode aria-hidden="true" />}
                                    <p>{loading ? 'Memuatkan…' : error ? 'Menunggu sambungan pulih' : 'Menunggu sesi aktif'}</p>
                                </div>
                            )}
                        </div>
                        <p className={styles.scanHelp}>{active ? 'Buka kamera telefon dan imbas kod QR.' : 'Sila tunggu arahan daripada urus setia.'}</p>
                        {active && event && <div className={styles.session}><span>Kod sesi</span><strong>{event.kod_sesi}</strong></div>}
                    </section>
                </div>
            </main>

            <footer className={styles.footer}>
                <span>JPAEvents</span>
                <span>{error ? 'Mencuba semula secara automatik' : 'Paparan kehadiran dewan'}</span>
            </footer>
        </div>
    );
}
