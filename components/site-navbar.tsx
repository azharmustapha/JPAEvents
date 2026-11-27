'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { HamburgerMenuIcon, CrossIcon, LogoutIcon } from '@govtechmy/myds-react/icon';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { useOrganizer } from './organizer-provider';
import { organizerLinks } from './organizer-links';
import { organizerHref } from '@/lib/organizer-navigation';

export function SiteNavbar() {
  const { userId, authLoading, event, pathname } = useOrganizer();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const open = openPath === pathname;
  const authenticated = Boolean(userId);
  const links = authenticated ? organizerLinks(event?.id ?? null) : [
    { href: '/', label: 'Utama', activePath: '/', icon: null },
    { href: '/admin/login', label: 'Log masuk', activePath: '/admin/login', icon: null },
  ];
  async function signOut() {
    setSigningOut(true); setError('');
    try {
      const client = getBrowserSupabase();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        // This SDK also clears local credentials when remote revocation fails.
        // Offer retry only when there is still a local session to sign out.
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (session || sessionError) throw error;
      }
      window.location.replace('/admin/login');
    } catch { setError('Log keluar gagal. Sila cuba lagi.'); setSigningOut(false); }
  }
  function navigationLinks() {
    return <>{links.map(({ href, label, activePath, icon: Icon }) => {
      const active = activePath === '/admin' || activePath === '/' ? pathname === activePath : Boolean(activePath && pathname.startsWith(activePath));
      if (authenticated && label === 'Tayangan' && !event?.published) return <span key={label} aria-disabled="true" title="Terbitkan acara untuk membuka tayangan" className="site-nav-link is-disabled">{Icon && <Icon aria-hidden="true" className="size-4" />}<span>{label}</span></span>;
      return <Link key={label} href={href} onClick={() => setOpenPath(null)} aria-current={active ? 'page' : undefined} className={`site-nav-link${active ? ' is-active' : ''}`}>
        {Icon && <Icon aria-hidden="true" className="size-4" />}<span>{label}</span>
      </Link>;
    })}{authenticated && <button type="button" onClick={() => void signOut()} disabled={signingOut} className="site-nav-link nav-logout"><LogoutIcon aria-hidden="true" className="size-4" /><span>{signingOut ? 'Keluar…' : 'Log keluar'}</span></button>}</>;
  }
  return <header className="airline-navbar government-navbar" onKeyDown={e => { if (e.key === 'Escape') setOpenPath(null); }}>
    <nav aria-label="Navigasi utama" className="site-navigation">
      <div className="site-nav-row">
        <Link href={authenticated ? organizerHref('/admin', event?.id ?? null) : '/'} onClick={() => setOpenPath(null)} className="government-brand">
          <Image src="/jata-negara.png" alt="Jata Negara" width={56} height={48} className="government-crest" />
          <span><strong>{event?.organizer_name || 'JPAEvents'}</strong><small>{event?.tema || 'Pengurusan dan pendaftaran acara'}</small></span>
        </Link>
        <div className="site-desktop-links" aria-busy={authLoading}>{!authLoading && navigationLinks()}</div>
        <button type="button" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpenPath(open ? null : pathname)} className="site-menu-toggle">
          {open ? <CrossIcon aria-hidden="true" /> : <HamburgerMenuIcon aria-hidden="true" />}
        </button>
      </div>
      {open && <div id="mobile-navigation" className="site-mobile-links">{navigationLinks()}</div>}
      {error && <p role="alert" className="nav-error">{error}</p>}
    </nav>
  </header>;
}
