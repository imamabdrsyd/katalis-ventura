'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, LayoutGrid, ShoppingBag } from 'lucide-react';
import { OmnichannelSection } from '@/components/omnichannel/OmnichannelSection';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MarketInsightSection } from '@/components/market/MarketInsightSection';
import HealthScoreCalculator from '@/components/landing/HealthScoreCalculator';

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

type Lang = 'id' | 'en';

const content = {
  id: {
    navAccounting: 'Accounting Engine',
    navOmnichannel: 'Omnichannel',
    navEcommerce: 'Ecommerce Integration',
    heroTag: 'Accounting Engine',
    heroTitle1: 'People lie, ',
    heroTitle2: "numbers don't.",
    heroSub: "Dan angka-angka dalam bisnis Anda sedang bercerita — mau Anda dengarkan atau tidak.\nAXION membantu Anda mendengar, agar setiap keputusan bisnis berbasis data.",
    heroCta: 'Masuk ke AXION',
    aum: 'Assets Under Management',
    card1Title: 'Keuangan bisnis tercatat rapi',
    card1Body: 'Nggak perlu lagi buka-tutup spreadsheet atau nunggu laporan dari akuntan yang datangnya telat. Semua transaksi harian, laporan bulanan, sampai neraca bisnis kamu — sudah tercatat otomatis dan bisa dicek kapan saja.',
    card1Badge: 'Accounting',
    card2Title: 'Cek ketersediaan di satu channel terpusat',
    card2Body: 'Stok di toko fisik, website, dan marketplace kamu terpantau dari satu tempat. Nggak perlu lagi cek satu-satu atau khawatir overselling gara-gara data yang nggak sinkron antar channel.',
    card2Badge: 'Omnichannel',
    card3Title: 'Sinkronisasi order, pembukuan otomatis',
    card3Body: 'Setiap order masuk dari Tokopedia, Shopee, atau marketplace lain langsung tercatat di pembukuan — tanpa input manual, tanpa selisih angka di akhir bulan. Kamu fokus jualan, sisanya biar sistem yang urus.',
    card3Badge: 'Integrasi E-Commerce',
    ecomTag: 'Omnichannel Ready',
    ecomTitle: 'Ecommerce Integration',
    ecomBody: 'Hubungkan bisnis Anda dengan marketplace dan platform sosial terpopuler Indonesia. Tampilkan produk, terima pesanan, dan kelola semua saluran penjualan dari satu halaman publik — tanpa perlu website sendiri.',
    footerLabel: 'Platform Keuangan Bisnis',
    footerTitle: 'Kelola bisnis lebih cerdas.',
    footerCta: 'Limited Partner Login',
    copyright: '© 2026 PT Imam Katalis Ventura. All rights reserved.',
  },
  en: {
    navAccounting: 'Accounting Engine',
    navOmnichannel: 'Omnichannel',
    navEcommerce: 'Ecommerce Integration',
    heroTag: 'Accounting Engine',
    heroTitle1: 'People lie, ',
    heroTitle2: "numbers don't.",
    heroSub: "And the numbers in your business are telling a story whether you're listening or not.\nAXION helps you listen so you can make data-driven decisions for your business.",
    heroCta: 'Enter AXION',
    aum: 'Assets Under Management',
    card1Title: 'Business finances recorded neatly',
    card1Body: 'No more opening and closing spreadsheets or waiting on an accountant\'s delayed report. Every daily transaction, monthly statement, and balance sheet — automatically recorded and accessible anytime.',
    card1Badge: 'Accounting',
    card2Title: 'Check availability from one central channel',
    card2Body: 'Stock across your physical store, website, and marketplaces are monitored from a single place. No more checking them one by one or worrying about overselling due to out-of-sync data across channels.',
    card2Badge: 'Omnichannel',
    card3Title: 'Order sync, automatic bookkeeping',
    card3Body: 'Every order from Tokopedia, Shopee, or any other marketplace is recorded directly in your books — no manual input, no number discrepancies at month end. You focus on selling, the system handles the rest.',
    card3Badge: 'E-Commerce Integration',
    ecomTag: 'Omnichannel Ready',
    ecomTitle: 'Ecommerce Integration',
    ecomBody: 'Connect your business with Indonesia\'s most popular marketplaces and social platforms. Display products, receive orders, and manage all sales channels from one public page — no website needed.',
    footerLabel: 'Business Finance Platform',
    footerTitle: 'Run your business smarter.',
    footerCta: 'Limited Partner Login',
    copyright: '© 2026 PT Imam Katalis Ventura. All rights reserved.',
  },
} as const;

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, businesses: 0, businessLogos: [] });
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<Lang>('id');

  useEffect(() => {
    const saved = localStorage.getItem('axion_lang') as Lang | null;
    if (saved === 'id' || saved === 'en') setLang(saved);
  }, []);

  const switchLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('axion_lang', l);
  };

  const t = content[lang];

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
          <span className="hidden sm:block text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700 pl-4">
            Family Offices
          </span>
          <div className="hidden sm:flex items-center gap-6 ml-auto">
            <nav className="flex items-center gap-2">
              {([
                { label: t.navAccounting, href: '#section-accounting' },
                { label: t.navOmnichannel, href: '#section-omnichannel' },
                { label: t.navEcommerce, href: '#section-ecommerce' },
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
            {t.heroTag}
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-5 leading-[1.1] tracking-tight">
            <span className="text-gray-900 dark:text-gray-100">{t.heroTitle1}</span>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {t.heroTitle2}
            </span>
          </h1>

          <p className="text-base text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
            {t.heroSub}
          </p>

          <Link
            href="/login"
            className="group relative inline-block px-10 py-3.5 text-white rounded-xl font-semibold text-lg overflow-hidden bg-[length:200%_100%] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-left hover:bg-right transition-[background-position] duration-500 ease-in-out"
          >
            {t.heroCta}
          </Link>
        </div>

        {/* Business Logo Marquee */}
        {stats.businessLogos.length > 0 && (
          <div className="max-w-5xl mx-auto w-full mb-12">
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-4 font-medium">{t.aum}</p>
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
            <BookOpen className="w-6 h-6 text-primary-500 mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              {t.card1Title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              {t.card1Body}
            </p>
            <div className="mt-5">
              <span className="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold rounded-lg">
                {t.card1Badge}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col">
            <LayoutGrid className="w-6 h-6 text-primary-500 mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              {t.card2Title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              {t.card2Body}
            </p>
            <div className="mt-5">
              <span className="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold rounded-lg">
                {t.card2Badge}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col">
            <ShoppingBag className="w-6 h-6 text-primary-500 mb-5" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              {t.card3Title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              {t.card3Body}
            </p>
            <div className="mt-5">
              <span className="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold rounded-lg">
                {t.card3Badge}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Health Score Calculator */}
        <div className="max-w-4xl mx-auto w-full mb-12">
          <HealthScoreCalculator />
          <div className="text-center mt-3">
            <a
              href="/cek-bisnis"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Buka di halaman penuh
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 9.5l7-7M9.5 2.5H5M9.5 2.5v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* Ecommerce Integration */}
        <div id="section-ecommerce" className="max-w-5xl mx-auto w-full mb-12">
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 md:p-10">
            <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start md:items-center">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold mb-4">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                  {t.ecomTag}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  {t.ecomTitle}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t.ecomBody}
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

        {/* <MarketInsightSection /> */}

      </main>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950">
        {/* Brand CTA + Stats satu baris */}
        <div className="container mx-auto px-6 pt-10 pb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-gray-400 mb-2">
              {t.footerLabel}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {t.footerTitle}
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
            {t.footerCta}
          </Link>
        </div>

        {/* Copyright bar */}
        <div className="border-t border-gray-800">
          <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-2">
            <p>{t.copyright}</p>
            <div className="flex items-center gap-4">
              {/* Language switcher */}
              <div className="flex items-center gap-1 border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => switchLang('id')}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${lang === 'id' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  ID
                </button>
                <button
                  onClick={() => switchLang('en')}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${lang === 'en' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  EN
                </button>
              </div>
              <Link
                href="/blog"
                className="hover:text-gray-300 transition-colors"
              >
                Blog
              </Link>
              {/* Market nav hidden — fitur market aggregator belum live */}
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
