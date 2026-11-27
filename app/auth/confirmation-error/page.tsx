import Link from 'next/link';
import { ResendConfirmation } from '@/components/resend-confirmation';

export default function ConfirmationErrorPage() {
  return <main className="account-page">
    <h1>Pengesahan belum berjaya</h1>
    <p>Pautan mungkin telah tamat tempoh, sudah digunakan atau tidak lengkap. Jika e-mel anda sudah disahkan, teruskan dengan log masuk.</p>
    <p><Link href="/admin/login" className="primary-action">Log masuk penganjur</Link></p>
    <ResendConfirmation />
    <p>Belum mencipta akaun? <Link href="/signup">Daftar akaun penganjur</Link></p>
  </main>;
}
