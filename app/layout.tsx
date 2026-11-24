import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Anda boleh tukar font jika mahu
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Suspense } from 'react';
import { SiteNavbar } from '@/components/site-navbar';
import { SiteFooter } from '@/components/site-footer';

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = {
  title: "JPAEvents",
  description: "Pendaftaran acara dan pas digital untuk setiap penganjur.",
  referrer: 'no-referrer',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms">
      <body className={`${inter.className} ${inter.variable} site-background text-slate-900 antialiased selection:bg-amber-200 selection:text-[#003053]`}>
        <Suspense fallback={<div className="h-20 bg-[#003053]" />}><SiteNavbar /></Suspense>
        <div className="site-content mx-auto max-w-7xl">
        {children}
        </div>
        <SiteFooter />
        <SpeedInsights />
      </body>
    </html>
  );
}
