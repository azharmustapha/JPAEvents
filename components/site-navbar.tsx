'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from './brand-logo';

const links = [
  { href: '/', label: 'Utama' },
  { href: '/admin/login', label: 'Log Masuk' },
];

export function SiteNavbar() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  function navigationLinks() {
    return links.map(({ href, label }) => {
      const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
      return (
        <Link key={href} href={href} onClick={() => setOpenPath(null)}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${active ? 'bg-white/10 text-amber-200 underline decoration-amber-200 decoration-2 underline-offset-8' : 'text-white hover:bg-white/10'}`}>
          {label}
        </Link>
      );
    });
  }

  return (
    <header className="airline-navbar bg-[#003053] text-white" onKeyDown={event => { if (event.key === 'Escape') setOpenPath(null); }}>
      <nav aria-label="Navigasi utama" className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-20 items-center justify-between gap-3">
          <Link href="/" onClick={() => setOpenPath(null)} className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-amber-300">
            <BrandLogo />
            <span><span className="block text-sm font-bold tracking-wide sm:text-base">JPAEvents</span><span className="mt-0.5 hidden text-xs text-slate-200 sm:block">Pendaftaran untuk semua acara</span></span>
          </Link>
          <div className="hidden items-center gap-2 md:flex">{navigationLinks()}</div>
          <button type="button" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={open} aria-controls="mobile-navigation"
            onClick={() => setOpenPath(open ? null : pathname)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300 md:hidden">
            {open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
          </button>
        </div>
        {open && <div id="mobile-navigation" className="grid gap-1 border-t border-white/15 py-3 md:hidden">{navigationLinks()}</div>}
      </nav>
    </header>
  );
}
