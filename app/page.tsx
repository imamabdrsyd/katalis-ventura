'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Monitor, TrendingUp, Shield } from 'lucide-react';
import { OmnichannelSection } from '@/components/omnichannel/OmnichannelSection';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface BusinessLogo {
  id: string;
  business_name: string;
  logo_url: string;
  logo_fit?: 'cover' | 'contain' | null;
}

interface Stats {
  users: number;
  businesses: number;
  businessLogos: BusinessLogo[];
}

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, businesses: 0, businessLogos: [] });
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-indigo-50 dark:bg-gray-900 flex flex-col" style={{ scrollBehavior: 'smooth' }}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 py-3'
          : 'bg-indigo-50 dark:bg-gray-900 py-5'
      }`}>
        <nav className="container mx-auto px-6 flex items-center justify-between gap-4">
          <div className="shrink-0 relative h-9 flex items-center">
            {/* Favicon logo (scrolled) */}
            <Image
              src="/images/favicon.png"
              alt="Axion Logo"
              width={36}
              height={36}
              className={`object-contain dark:hidden transition-all duration-300 ${scrolled ? 'opacity-100 scale-100' : 'opacity-0 scale-75 absolute pointer-events-none'}`}
            />
            <Image
              src="/images/favicon-dark.png"
              alt="Axion Logo"
              width={36}
              height={36}
              className={`object-contain hidden transition-all duration-300 ${scrolled ? 'dark:block opacity-100 scale-100' : 'opacity-0 scale-75 absolute pointer-events-none'}`}
            />
            {/* Full logo (not scrolled) */}
            <Image
              src="/images/axion.png"
              alt="Axion Logo"
              width={110}
              height={36}
              className={`object-contain dark:hidden transition-all duration-300 ${scrolled ? 'opacity-0 scale-75 absolute pointer-events-none' : 'opacity-100 scale-100'}`}
            />
            <Image
              src="/images/axion-dark.png"
              alt="Axion Logo"
              width={110}
              height={36}
              className={`object-contain hidden transition-all duration-300 ${scrolled ? 'opacity-0 scale-75 absolute pointer-events-none' : 'dark:block opacity-100 scale-100'}`}
            />
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <nav className="flex items-center gap-2">
              {([
                { label: 'Accounting Engine', href: '#section-accounting' },
                { label: 'Omnichannel', href: '#section-omnichannel' },
                { label: 'Ecommerce Integration', href: '#section-ecommerce' },
              ]).map(({ label, href }, i, arr) => (
                <Fragment key={label}>
                  <a
                    href={href}
                    className="px-2 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border-b border-transparent hover:border-indigo-600 dark:hover:border-indigo-400"
                  >
                    {label}
                  </a>
                  {i < arr.length - 1 && (
                    <span className="text-gray-300 dark:text-gray-600 text-xs select-none px-1">|</span>
                  )}
                </Fragment>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* Hero + Features combined */}
      <main className="flex-1 container mx-auto px-6 pt-24 pb-10 flex flex-col">
        {/* Omnichannel Widget */}
        <div id="section-omnichannel" className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-gray-900/60 border border-gray-100 dark:border-gray-700 mb-16 overflow-hidden">
          <OmnichannelSection />
        </div>

        {/* Hero */}
        <div id="section-accounting" className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold mb-5">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
            Accounting Engine
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-5 leading-[1.1] tracking-tight">
            <span className="text-gray-900 dark:text-gray-100">People lie, </span>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              numbers don't.
            </span>
          </h1>

          <p className="text-base text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            And the numbers in your business are telling a story whether you&apos;re listening or not.
            <br />
            AXION helps you listen so you can make data-driven decisions for your business.
          </p>

          <Link
            href="/login"
            className="group relative inline-block px-10 py-3.5 text-white rounded-xl font-semibold text-lg overflow-hidden bg-[length:200%_100%] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-left hover:bg-right transition-[background-position] duration-500 ease-in-out"
          >
            Enter AXION
          </Link>
        </div>

        {/* Business Logo Marquee */}
        {stats.businessLogos.length > 0 && (
          <div className="max-w-5xl mx-auto w-full mb-12">
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-4 font-medium">Assets Under Management</p>
            <div
              className="relative overflow-hidden group"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
              }}
            >
              <div className="flex gap-12 animate-marquee group-hover:[animation-play-state:paused]">
                {[...stats.businessLogos, ...stats.businessLogos].map((biz, i) => (
                  <div
                    key={`${biz.id}-${i}`}
                    className="flex-shrink-0 flex items-center gap-3 px-2"
                  >
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {biz.logo_url ? (
                        <Image
                          src={biz.logo_url}
                          alt={biz.business_name}
                          width={40}
                          height={40}
                          className={`w-10 h-10 ${biz.logo_fit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
                        />
                      ) : (
                        <span className="text-xs font-bold text-gray-400">
                          {biz.business_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {biz.business_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col">
            <Monitor className="w-6 h-6 text-indigo-500 mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              Semua entitas bisnis Anda, satu dashboard
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              Berhenti berpindah-pindah antara file Excel, aplikasi terpisah, dan laporan yang tidak sinkron. Axion menarik data dari seluruh perusahaan Anda — properti, trading, jasa — ke dalam satu tampilan konsolidasi yang selalu real-time.
            </p>
            <div className="mt-5">
              <span className="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg">
                Konsolidasi otomatis
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col">
            <TrendingUp className="w-6 h-6 text-indigo-500 mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              Laporan investor yang selama ini Anda buat manual — kini otomatis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              IRR, MOIC, cash position, dan burn rate per entitas — tersedia setiap saat tanpa harus menunggu laporan dari akuntan. Bagikan akses baca kepada investor atau LP Anda dengan satu klik, tanpa risiko data bocor.
            </p>
            <div className="mt-5">
              <span className="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg">
                PE-grade metrics
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col">
            <Shield className="w-6 h-6 text-indigo-500 mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              Akuntansi PSAK yang benar — tanpa perlu belajar akuntansi
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              Di balik antarmuka yang sederhana, setiap transaksi dicatat dengan double-entry yang patuh PSAK dan IFRS. Anda cukup input uang masuk dan keluar. Axion yang mengurus jurnal, neraca, dan laporan laba rugi.
            </p>
            <div className="mt-5">
              <span className="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg">
                PSAK &amp; IFRS compliant
              </span>
            </div>
          </div>
        </div>

        {/* Ecommerce Integration */}
        <div id="section-ecommerce" className="max-w-5xl mx-auto w-full mb-12">
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 md:p-10">
            <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start md:items-center">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold mb-4">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                  Omnichannel Ready
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Ecommerce Integration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Hubungkan bisnis Anda dengan marketplace dan platform sosial terpopuler Indonesia. Tampilkan produk, terima pesanan, dan kelola semua saluran penjualan dari satu halaman publik — tanpa perlu website sendiri.
                </p>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <div className="flex gap-6 items-center justify-center md:justify-end">
                  {[
                    { name: 'Shopee', src: '/images/ecommerce/Shopee.png' },
                    { name: 'TikTok Shop', src: '/images/ecommerce/Tiktokshop.png' },
                    { name: 'Tokopedia', src: '/images/ecommerce/Tokopedia.png' },
                  ].map(({ name, src }) => (
                    <div key={name} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                        <Image src={src} alt={name} width={40} height={40} className="object-contain" />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950">
        {/* Brand CTA + Stats satu baris */}
        <div className="container mx-auto px-6 pt-10 pb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-gray-400 mb-2">
              Platform Keuangan Bisnis
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Kelola bisnis lebih cerdas.
            </h2>
          </div>

          {/* Stats inline di tengah */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-bold text-white text-lg">100%</div>
              <div className="text-gray-400">Data Privacy</div>
            </div>
            <span className="w-px h-8 bg-gray-700"></span>
            <div className="text-center">
              <div className="font-bold text-white text-lg">{loading ? '...' : stats.users}</div>
              <div className="text-gray-400">Users</div>
            </div>
            <span className="w-px h-8 bg-gray-700"></span>
            <div className="text-center">
              <div className="font-bold text-white text-lg">{loading ? '...' : stats.businesses}</div>
              <div className="text-gray-400">Businesses</div>
            </div>
          </div>

          <Link
            href="/login"
            className="shrink-0 px-8 py-3 border border-gray-600 text-gray-200 font-semibold text-sm rounded-xl hover:border-gray-400 hover:text-white transition-colors"
          >
            Limited Partner Login
          </Link>
        </div>

        {/* Copyright bar */}
        <div className="border-t border-gray-800">
          <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-2">
            <p>&copy; 2026 PT Imam Katalis Ventura. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link
                href="/blog"
                className="hover:text-gray-300 transition-colors"
              >
                Blog
              </Link>
              <a
                href="https://instagram.com/imamabdrsyd"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-300 transition-colors"
              >
                @imamabdrsyd
              </a>
              <a
                href="mailto:imam.isyida@gmail.com"
                className="hover:text-gray-300 transition-colors"
              >
                imam.isyida@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
