import Link from 'next/link';
import { BrandLogo } from './brand-logo';

const footerLinks = [
  { href: '/', label: 'Utama' },
  { href: '/admin/login', label: 'Log Masuk' },
];

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Maklumat laman">
      <div className="footer-content">
        <div className="footer-brand">
          <Link href="/" className="footer-brand-link">
            <BrandLogo />
            <span>
              <span className="footer-brand-name">JPAEvents</span>
              <span className="footer-brand-subtitle">Pendaftaran untuk semua acara</span>
            </span>
          </Link>
          <p className="footer-description">Cipta acara, kongsi pautan dan mudahkan pendaftaran peserta.</p>
        </div>
        <nav className="footer-navigation" aria-labelledby="footer-navigation-title">
          <h2 id="footer-navigation-title">Pautan pantas</h2>
          <ul className="footer-links">
            {footerLinks.map(({ href, label }) => (
              <li key={href}><Link href={href}>{label}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>JPAEvents</p>
          <p>Daftar masuk · Pasport digital · Cabutan bertuah</p>
        </div>
      </div>
    </footer>
  );
}
