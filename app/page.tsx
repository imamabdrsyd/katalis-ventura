'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, TrendingUp, Shield } from 'lucide-react';
import { OmnichannelSection } from '@/components/omnichannel/OmnichannelSection';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface BusinessLogo {
  id: string;
  business_name: string;
  logo_url: string;
}

interface Stats {
  users: number;
  businesses: number;
  businessLogos: BusinessLogo[];
}

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, businesses: 0, businessLogos: [] });
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-indigo-50 dark:bg-gray-900 flex flex-col" style={{ scrollBehavior: 'smooth' }}>
      {/* Header */}
      <header className="container mx-auto px-6 py-5">
        <nav className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <Image
              src="/images/axion.png"
              alt="Axion Logo"
              width={110}
              height={36}
              className="object-contain dark:hidden"
            />
            <Image
              src="/images/axion-dark.png"
              alt="Axion Logo"
              width={110}
              height={36}
              className="object-contain hidden dark:block"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {([
                { label: 'Accounting Engine', href: '#section-accounting' },
                { label: 'Omnichannel', href: '#section-omnichannel' },
                { label: 'Ecommerce Integration', href: '#section-ecommerce' },
              ]).map(({ label, href }, i, arr) => (
                <Fragment key={label}>
                  <a
                    href={href}
                    className="px-1 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border-b border-transparent hover:border-indigo-600 dark:hover:border-indigo-400"
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
      <main className="flex-1 container mx-auto px-6 pt-4 pb-10 flex flex-col">
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

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-[1.1] tracking-tight">
            People, numbers don't.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              And the numbers in your business are telling a story
            </span>
          </h1>

          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
            Whether you are listening or not.
            AXION helps you listen so you can make data-driven decisions for your growing business.
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
                    <Image
                      src={biz.logo_url}
                      alt={biz.business_name}
                      width={40}
                      height={40}
                      className="rounded-lg object-cover w-10 h-10"
                    />
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
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <Briefcase className="w-6 h-6 text-indigo-500 mb-3" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
              Business Manager
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kelola keuangan bisnis secara profesional dengan double-entry bookkeeping, laporan otomatis, dan transparansi data untuk membangun kepercayaan investor.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <TrendingUp className="w-6 h-6 text-blue-500 mb-3" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
              Investor
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pantau portofolio bisnis di bawah manajemen Katalis Ventura. Lihat laporan keuangan real, analisis ROI, dan metrik performa sebelum membuat keputusan.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <Shield className="w-6 h-6 text-pink-500 mb-3" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
              Secure & Private
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kontrol akses per role (manager & investor), Row-Level Security di database, dan audit trail lengkap di setiap perubahan data.
            </p>
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
      <footer className="bg-gradient-to-r from-indigo-500 to-purple-500">
        {/* Brand CTA */}
        <div className="container mx-auto px-6 pt-10 pb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-200 mb-2">
              Platform Keuangan Bisnis
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Kelola bisnis lebih cerdas.
            </h2>
          </div>
          <Link
            href="/login"
            className="shrink-0 px-8 py-3 bg-white text-indigo-700 font-semibold text-sm rounded-xl hover:bg-indigo-50 transition-colors"
          >
            Enter AXION
          </Link>
        </div>

        {/* Copyright + Stats + Social — satu baris */}
        <div className="border-t border-white/20">
          <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-sm text-indigo-100 gap-3">
            <p className="shrink-0">&copy; 2026 PT Imam Katalis Ventura.</p>

            {/* Stats inline di tengah */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <span className="font-bold text-white">100%</span>
                <span className="text-indigo-200 ml-1.5">Data Privacy</span>
              </div>
              <span className="text-white/30">·</span>
              <div className="text-center">
                <span className="font-bold text-white">{loading ? '...' : stats.users}</span>
                <span className="text-indigo-200 ml-1.5">Users</span>
              </div>
              <span className="text-white/30">·</span>
              <div className="text-center">
                <span className="font-bold text-white">{loading ? '...' : stats.businesses}</span>
                <span className="text-indigo-200 ml-1.5">Businesses</span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <a
                href="https://instagram.com/imamabdrsyd"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                @imamabdrsyd
              </a>
              <a
                href="mailto:imam.isyida@gmail.com"
                className="hover:text-white transition-colors"
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
