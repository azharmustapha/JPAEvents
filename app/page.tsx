import Link from 'next/link';
import { CalendarDays, Palette, QrCode, Users } from 'lucide-react';
export default function HomePage() {
  return <main className="event-welcome">
    <section className="welcome-hero">
      <div><p className="welcome-intro"><CalendarDays size={22} /> Pendaftaran yang menyambut semua</p><h1>Acara anda.<br />Mudah disertai.</h1><p className="welcome-copy">Dari bengkel kecil hingga majlis besar. Sediakan halaman acara, kongsi pautan dan urus peserta dalam satu tempat.</p><div className="welcome-actions"><Link className="primary-action" href="/signup">Cipta akaun penganjur</Link><Link className="secondary-action" href="/admin/login">Log masuk</Link></div><p className="mt-5 text-sm text-slate-600">Sudah menerima jemputan? Buka pautan atau imbas kod QR daripada penganjur anda.</p></div>
      <div className="welcome-ticket" aria-label="Cara JPAEvents berfungsi"><div className="ticket-top"><CalendarDays size={34} /><strong>JPAEvents</strong><span>Setiap acara, identiti sendiri</span></div><div className="ticket-steps"><p><Palette /> Butiran dan tema pilihan anda</p><p><QrCode /> Satu pautan untuk pendaftaran</p><p><Users /> Senarai peserta dalam kawalan anda</p></div><div className="ticket-bottom">Peserta mendaftar tanpa akaun.</div></div>
    </section><section className="welcome-explanation"><h2>Dari persediaan ke hari acara</h2><div><p><strong>Cipta & sesuaikan</strong>Tambah tarikh, lokasi, logo dan warna acara. Pratonton sebelum diterbitkan.</p><p><strong>Kongsi & daftar</strong>Kongsi halaman anda. Peserta isi maklumat dan simpan pas digital.</p><p><strong>Urus & jalankan</strong>Semak peserta, susun agenda, papar QR dan eksport senarai untuk sijil.</p></div></section>
  </main>;
}
