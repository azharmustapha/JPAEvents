'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { HamburgerMenuIcon, CrossIcon, LogoutIcon, UserIcon, ChevronDownIcon } from '@govtechmy/myds-react/icon';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { useOrganizer } from './organizer-provider';
import { organizerLinks, type OrganizerLink } from './organizer-links';
import { organizerHref } from '@/lib/organizer-navigation';

export function SiteNavbar() {
  const { userId, authLoading, event, pathname, explicitId } = useOrganizer();
  const locationKey = `${pathname}:${explicitId ?? ''}`;
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [profilePath, setProfilePath] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const open = openPath === locationKey;
  const profileOpen = profilePath === locationKey;
  const authenticated = Boolean(userId);
  const branding = pathname === '/admin' || pathname === '/admin/sesi-baru' ? null : event;
  const links: OrganizerLink[] = authenticated ? organizerLinks(event?.id ?? null) : [
    { href: '/', label: 'Utama', activePath: '/', icon: null, group: 'primary' },
    { href: '/admin/login', label: 'Log masuk', activePath: '/admin/login', icon: null, group: 'primary' },
  ];

  useEffect(() => {
    if (!profileOpen) return;
    const outside = (e: PointerEvent) => { if (!profileRef.current?.contains(e.target as Node)) setProfilePath(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [profileOpen]);

  function closeMenus() { setOpenPath(null); setProfilePath(null); }
  async function signOut() {
    setSigningOut(true); setError('');
    try {
      const client = getBrowserSupabase();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (session || sessionError) throw error;
      }
      window.location.replace('/admin/login');
    } catch { setError('Log keluar gagal. Sila cuba lagi.'); setSigningOut(false); }
  }
  function navigationLinks(items: OrganizerLink[]) {
    return items.map(({ href, label, activePath, icon: Icon }) => {
      const active = activePath === '/admin' || activePath === '/' ? pathname === activePath : Boolean(activePath && pathname.startsWith(activePath));
      if (authenticated && label === 'Tayangan' && !event?.published) return <span key={label} aria-disabled="true" title="Terbitkan acara untuk membuka tayangan" className="site-nav-link is-disabled">{Icon && <Icon aria-hidden="true" className="size-4" />}<span>{label}</span></span>;
      return <Link key={label} href={href} onClick={closeMenus} aria-current={active ? 'page' : undefined} className={`site-nav-link${active ? ' is-active' : ''}`}>
        {Icon && <Icon aria-hidden="true" className="size-4" />}<span>{label}</span>
      </Link>;
    });
  }
  const logout = <button type="button" onClick={() => void signOut()} disabled={signingOut} className="site-nav-link nav-logout"><LogoutIcon aria-hidden="true" className="size-4" /><span>{signingOut ? 'Keluar…' : 'Log keluar'}</span></button>;

  return <header className="airline-navbar government-navbar" onKeyDown={e => {
    if (e.key === 'Escape') { closeMenus(); if (profileOpen) profileButton.current?.focus(); else if (open) mobileButton.current?.focus(); }
  }}>
    <nav aria-label="Navigasi utama" className="site-navigation">
      <div className="site-nav-row">
        <Link href={authenticated ? organizerHref('/admin', event?.id ?? null) : '/'} onClick={closeMenus} className="government-brand">
          <Image src="/jata-negara.png" alt="Jata Negara" width={56} height={48} className="government-crest" />
          <span><strong>{branding?.organizer_name || 'JPAEvents'}</strong><small>{branding?.tema || 'Setiap acara, satu pengalaman.'}</small></span>
        </Link>
        <div className="site-desktop-links" aria-busy={authLoading}>{!authLoading && <>
          {navigationLinks(links.filter(link => link.group === 'primary'))}
          {authenticated && <div className="nav-profile" ref={profileRef} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setProfilePath(null); }}>
            <button ref={profileButton} type="button" className={`nav-profile-toggle${profileOpen ? ' is-open' : ''}`} aria-label="Menu profil penganjur" aria-expanded={profileOpen} aria-controls="profile-navigation" onClick={() => setProfilePath(profileOpen ? null : locationKey)}><span className="nav-profile-avatar"><UserIcon aria-hidden="true" /></span><span>Penganjur</span><ChevronDownIcon aria-hidden="true" className="size-4" /></button>
            {profileOpen && <div id="profile-navigation" className="nav-profile-dropdown"><p>Pengurusan acara</p>{navigationLinks(links.filter(link => link.group === 'profile'))}<div className="nav-profile-divider" />{logout}</div>}
          </div>}
        </>}</div>
        <button ref={mobileButton} type="button" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpenPath(open ? null : locationKey)} className="site-menu-toggle">
          {open ? <CrossIcon aria-hidden="true" /> : <HamburgerMenuIcon aria-hidden="true" />}
        </button>
      </div>
      {open && <div id="mobile-navigation" className="site-mobile-links"><div className="mobile-primary-links">{navigationLinks(links.filter(link => link.group === 'primary'))}</div>{authenticated && <div className="mobile-profile-links">{navigationLinks(links.filter(link => link.group === 'profile'))}{logout}</div>}</div>}
      {error && <p role="alert" className="nav-error">{error}</p>}
    </nav>
  </header>;
}
