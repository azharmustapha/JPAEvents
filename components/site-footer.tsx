'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useOrganizer } from './organizer-provider';
import { organizerLinks } from './organizer-links';
import { organizerHref } from '@/lib/organizer-navigation';

export function SiteFooter() {
  const { userId, event } = useOrganizer();
  if (userId) return <footer className="organizer-footer" aria-label="Maklumat laman"><div><p><strong>JPAEvents</strong><span>Ruang untuk setiap acara.</span></p><nav aria-label="Pautan ruang penganjur"><Link href={organizerHref('/admin', event?.id ?? null)}>Acara saya</Link><Link href="/admin/sesi-baru">Cipta acara</Link></nav></div></footer>;
  const links = userId ? organizerLinks(event?.id ?? null) : [{ href: '/', label: 'Utama' }, { href: '/admin/login', label: 'Log masuk' }];
  return <footer className="site-footer government-footer" aria-label="Maklumat laman">
    <div className="footer-content">
      <div className="footer-brand">
        <Link href={userId ? organizerHref('/admin', event?.id ?? null) : '/'} className="footer-brand-link">
          <Image src="/jata-negara.png" alt="Jata Negara" width={56} height={48} className="government-crest" />
          <span><span className="footer-brand-name">{event?.organizer_name || 'JPAEvents'}</span><span className="footer-brand-subtitle">{event?.tema || 'Pengurusan dan pendaftaran acara'}</span></span>
        </Link>
        <p className="footer-description">{event ? event.tajuk : 'Cipta acara, kongsi pautan dan mudahkan pendaftaran peserta.'}</p>
      </div>
      <nav className="footer-navigation" aria-labelledby="footer-navigation-title"><h2 id="footer-navigation-title">Pautan pantas</h2><ul className="footer-links">{links.map(({ href, label }) => <li key={label}>{userId && label === 'Tayangan' && !event?.published ? <span aria-disabled="true" title="Terbitkan acara untuk membuka tayangan" className="footer-disabled">{label}</span> : <Link href={href}>{label}</Link>}</li>)}</ul></nav>
    </div>
    <div className="footer-bottom"><div className="footer-bottom-content"><p>JPAEvents{event?.kod_sesi ? ` · ${event.kod_sesi}` : ''}</p><p>Pendaftaran acara · Pas digital · Kehadiran</p></div></div>
  </footer>;
}
