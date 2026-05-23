'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { OmnichannelSection } from '@/components/omnichannel/OmnichannelSection';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import HealthScoreCalculator from '@/components/landing/HealthScoreCalculator';
import SingleSourceOfTruth from '@/components/landing/SingleSourceOfTruth';

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
    navSsot: 'Single Source of Truth',
    navOmnichannel: 'Omnichannel',
    navEcommerce: 'Ecommerce Integration',
    eyebrowHero: 'Accounting Engine',
    heroTitle1: 'People lie,',
    heroTitle2: "numbers don't.",
    heroSub:
      'Ada cerita di balik angka bisnis kamu entah kamu dengerin atau engga. AXION bantu kamu nangkep cerita itu, biar kamu tinggal ambil setiap keputusan berdasarkan data, bukan dugaan.',
    heroCta: 'Enter AXION',
    heroCtaSecondary: 'Lihat cara kerjanya',
    aumEyebrow: 'AXION Partners',
    aum: 'Assets Under Management',
    section1Eyebrow: 'Pembukuan otomatis',
    section1Title: 'Pembukuan double-entry, tanpa effort spreadsheet.',
    section1Lead:
      'Setiap transaksi mengalir ke buku besar, jurnal, dan laporan secara otomatis. Tutup buku tidak lagi menunggu akhir bulan — kapan saja, status keuangan tersedia.',
    section1Items: [
      {
        n: '01',
        title: 'Jurnal & buku besar otomatis',
        body: 'Input sekali, sistem yang menyusun jurnal, posting ke buku besar, dan menghitung saldo tiap akun.',
      },
      {
        n: '02',
        title: 'Laporan keuangan real-time',
        body: 'Neraca, laba rugi, dan arus kas selalu terkini — bukan snapshot bulan kemarin.',
      },
      {
        n: '03',
        title: 'Audit trail penuh',
        body: 'Setiap perubahan tercatat: siapa, kapan, dari nilai apa ke nilai apa. Tidak ada angka yang hilang diam-diam.',
      },
    ],
    ssotEyebrow: 'Single Source of Truth',
    ssotTitle: 'Catat sekali, semua laporan otomatis.',
    ssotLead:
      'Satu jurnal mengalir ke laba rugi, neraca, arus kas, dan dashboard investor — tidak ada rekonsiliasi manual, tidak ada angka yang berbeda antar laporan.',
    section2Eyebrow: 'Omnichannel inventory',
    section2Title: 'Satu stok, semua channel.',
    section2Lead:
      'Stok di toko fisik, website, dan marketplace dipantau dari satu tempat. Tidak ada overselling karena data tidak sinkron, tidak ada duplikasi entri.',
    section3Eyebrow: 'Ecommerce integration',
    section3Title: 'Order masuk, buku langsung tercatat.',
    section3Lead:
      'Hubungkan Tokopedia, Shopee, dan TikTok Shop. Setiap order otomatis masuk ke pembukuan — tanpa input manual, tanpa selisih di akhir bulan.',
    healthEyebrow: 'Tool gratis',
    healthTitle: 'Cek skor kesehatan bisnis Anda.',
    healthLead: 'Tiga angka, dua menit, satu skor. Tahu posisi bisnis Anda sebelum bicara dengan investor.',
    healthFullLink: 'Buka di halaman penuh',
    closingEyebrow: 'Mulai sekarang',
    closingTitle: 'Kelola bisnis lebih cerdas.',
    closingLead: 'Mulai dengan bisnis pertama kamu. Pindah dari spreadsheet dalam hitungan menit.',
    closingCta: 'Buka akun AXION',
    footerLabel: 'Platform Keuangan Bisnis',
    footerCta: 'Limited Partner Login',
    copyright: '© 2026 PT Imam Katalis Ventura. All rights reserved.',
    statUsers: 'Pengguna',
    statBusinesses: 'Bisnis',
    statPrivacy: 'Data Privacy',
  },
  en: {
    navAccounting: 'Accounting Engine',
    navSsot: 'Single Source of Truth',
    navOmnichannel: 'Omnichannel',
    navEcommerce: 'Ecommerce Integration',
    eyebrowHero: 'Accounting Engine',
    heroTitle1: 'People lie,',
    heroTitle2: "numbers don't.",
    heroSub:
      "The numbers in your business are telling a story — whether you're listening or not. AXION helps you listen, so every decision is built on data, not guesswork.",
    heroCta: 'Enter AXION',
    heroCtaSecondary: 'See how it works',
    aumEyebrow: 'AXION Partners',
    aum: 'Assets Under Management',
    section1Eyebrow: 'Automatic bookkeeping',
    section1Title: 'Double-entry accounting, without the spreadsheet effort.',
    section1Lead:
      'Every transaction flows into the ledger, journal, and reports automatically. Closing the books no longer waits for month-end — your financial picture is always available.',
    section1Items: [
      {
        n: '01',
        title: 'Auto-generated journals & ledgers',
        body: 'Enter once. The system handles journal entries, posting, and account balances.',
      },
      {
        n: '02',
        title: 'Real-time financial reports',
        body: 'Balance sheet, income statement, and cash flow always current — not last month’s snapshot.',
      },
      {
        n: '03',
        title: 'Full audit trail',
        body: 'Every change recorded: who, when, from what value to what value. No silent edits.',
      },
    ],
    ssotEyebrow: 'Single Source of Truth',
    ssotTitle: 'Record once, every report updates.',
    ssotLead:
      'One journal feeds the income statement, balance sheet, cash flow, and investor dashboard — no manual reconciliation, no numbers that disagree between reports.',
    section2Eyebrow: 'Omnichannel inventory',
    section2Title: 'One stock, every channel.',
    section2Lead:
      'Stock across your physical store, website, and marketplaces is monitored from one place. No overselling from out-of-sync data, no duplicated entries.',
    section3Eyebrow: 'Ecommerce integration',
    section3Title: 'Order in, books updated.',
    section3Lead:
      'Connect Tokopedia, Shopee, and TikTok Shop. Every order is recorded in your books automatically — no manual input, no month-end discrepancies.',
    healthEyebrow: 'Free tool',
    healthTitle: 'Check your business health score.',
    healthLead: 'Three numbers, two minutes, one score. Know where you stand before you talk to investors.',
    healthFullLink: 'Open in full page',
    closingEyebrow: 'Start now',
    closingTitle: 'Run your business smarter.',
    closingLead: 'Start with your first business. Move off spreadsheets in minutes.',
    closingCta: 'Open AXION account',
    footerLabel: 'Business Finance Platform',
    footerCta: 'Limited Partner Login',
    copyright: '© 2026 PT Imam Katalis Ventura. All rights reserved.',
    statUsers: 'Users',
    statBusinesses: 'Businesses',
    statPrivacy: 'Data Privacy',
  },
} as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeUpStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const heroWord: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, businesses: 0, businessLogos: [] });
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<Lang>('id');
  const reduce = useReducedMotion();

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

  const heroTitle1Words = t.heroTitle1.split(' ');
  const heroTitle2Words = t.heroTitle2.split(' ');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col antialiased" style={{ scrollBehavior: 'smooth' }}>
      {/* ───────── Navbar ───────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/85 dark:bg-gray-950/85 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <nav className="container mx-auto px-6 max-w-6xl flex items-center justify-between gap-6">
          <div className="shrink-0 relative h-9 flex items-center">
            <Image
              src="/images/favicon.png"
              alt="Axion Logo"
              width={36}
              height={36}
              className={`object-contain dark:hidden transition-all duration-300 ${
                scrolled ? 'opacity-100 scale-100' : 'opacity-0 scale-75 absolute pointer-events-none'
              }`}
            />
            <Image
              src="/images/favicon-dark.png"
              alt="Axion Logo"
              width={36}
              height={36}
              className={`object-contain hidden transition-all duration-300 ${
                scrolled ? 'dark:block opacity-100 scale-100' : 'opacity-0 scale-75 absolute pointer-events-none'
              }`}
            />
            <Image
              src="/images/axion.png"
              alt="Axion Logo"
              width={110}
              height={36}
              className={`object-contain dark:hidden transition-all duration-300 ${
                scrolled ? 'opacity-0 scale-75 absolute pointer-events-none' : 'opacity-100 scale-100'
              }`}
            />
            <Image
              src="/images/axion-dark.png"
              alt="Axion Logo"
              width={110}
              height={36}
              className={`object-contain hidden transition-all duration-300 ${
                scrolled ? 'opacity-0 scale-75 absolute pointer-events-none' : 'dark:block opacity-100 scale-100'
              }`}
            />
          </div>

          <div className="hidden md:flex items-center gap-8 ml-auto">
            <nav className="flex items-center gap-7">
              {(
                [
                  { label: t.navAccounting, href: '#section-accounting' },
                  { label: t.navSsot, href: '#section-ssot' },
                  { label: t.navOmnichannel, href: '#section-omnichannel' },
                  { label: t.navEcommerce, href: '#section-ecommerce' },
                ] as const
              ).map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  {label}
                </a>
              ))}
            </nav>
            <span className="w-px h-5 bg-gray-200 dark:bg-gray-800" />
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-full bg-gray-900 text-white hover:bg-primary-600 dark:bg-white dark:text-gray-900 dark:hover:bg-primary-500 dark:hover:text-white transition-colors cursor-pointer"
            >
              Limited Partner
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ───────── Hero ───────── */}
        <section className="relative pt-36 md:pt-44 pb-24 md:pb-32 overflow-hidden">
          {/* Editorial grid (Vercel-style square cells) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 dark:hidden"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px)',
              backgroundSize: '120px 120px',
              maskImage:
                'radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 80%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 80%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '120px 120px',
              maskImage:
                'radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 80%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 80%)',
            }}
          />

          <div className="container mx-auto px-6 max-w-6xl relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
              <div className="lg:col-span-7">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-6"
            >
              {t.eyebrowHero}
            </motion.p>

            <motion.h1
              initial={reduce ? false : 'hidden'}
              animate={reduce ? undefined : 'visible'}
              variants={fadeUpStagger}
              className="font-bold tracking-[-0.035em] leading-[0.95] text-[clamp(2.5rem,5.6vw,4.75rem)]"
            >
              <span className="block">
                {heroTitle1Words.map((word, i) => (
                  <span key={`t1-${i}`} className="inline-block overflow-hidden align-bottom">
                    <motion.span variants={heroWord} className="inline-block">
                      {word}
                      {i < heroTitle1Words.length - 1 && ' '}
                    </motion.span>
                  </span>
                ))}{' '}
              </span>
              <span className="block text-gray-400 dark:text-gray-600">
                {heroTitle2Words.map((word, i) => (
                  <span key={`t2-${i}`} className="inline-block overflow-hidden align-bottom">
                    <motion.span variants={heroWord} className="inline-block">
                      {word}
                      {i < heroTitle2Words.length - 1 && ' '}
                    </motion.span>
                  </span>
                ))}
              </span>
            </motion.h1>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 max-w-xl"
            >
              <p className="text-lg md:text-xl leading-relaxed text-gray-600 dark:text-gray-400">
                {t.heroSub}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-primary-600 dark:bg-white dark:text-gray-900 dark:hover:bg-primary-500 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {t.heroCta}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>

                <a
                  href="#section-ssot"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group cursor-pointer"
                >
                  {t.heroCtaSecondary}
                  <span className="transition-transform group-hover:translate-x-1">↓</span>
                </a>
              </div>
            </motion.div>
              </div>

              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.96, y: 24 }}
                animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                whileHover={
                  reduce
                    ? undefined
                    : { y: -10, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
                }
                className="lg:col-span-5 relative"
              >
                <div className="rounded-2xl overflow-hidden lg:scale-[1.1] lg:origin-center border border-gray-200 dark:border-gray-800 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] dark:hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] transition-shadow duration-500">
                  <Image
                    src="/images/landing-page-2.png"
                    alt="AXION dashboard preview"
                    width={2880}
                    height={1794}
                    priority
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="w-full h-auto block dark:hidden"
                  />
                  <Image
                    src="/images/landing-page-dark.png"
                    alt="AXION dashboard preview"
                    width={2880}
                    height={1794}
                    priority
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="w-full h-auto hidden dark:block"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ───────── Trust strip ───────── */}
        {stats.businessLogos.length > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="border-y border-gray-200 dark:border-gray-800 py-10"
          >
            <div className="container mx-auto px-6 max-w-6xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-7">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400">
                  {t.aumEyebrow}
                </p>
                <div className="flex items-center gap-8">
                  <Stat value={loading ? '—' : String(stats.businesses)} label={t.statBusinesses} />
                  <span className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
                  <Stat value={loading ? '—' : String(stats.users)} label={t.statUsers} />
                  <span className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
                  <Stat value="100%" label={t.statPrivacy} />
                </div>
              </div>

              <div
                className="relative overflow-hidden group"
                style={{
                  maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                }}
              >
                <div className="flex gap-14 animate-marquee group-hover:[animation-play-state:paused]">
                  {[...stats.businessLogos, ...stats.businessLogos].map((biz, i) => (
                    <div key={`${biz.id}-${i}`} className="flex-shrink-0 flex items-center gap-3 px-1">
                      <div className="w-9 h-9 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {biz.logo_url ? (
                          <Image
                            src={biz.logo_url}
                            alt={biz.business_name}
                            width={36}
                            height={36}
                            className={`w-9 h-9 transition ${
                              biz.logo_fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'
                            }`}
                          />
                        ) : (
                          <span className="text-xs font-bold text-gray-400">
                            {biz.business_name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-500 whitespace-nowrap">
                        {biz.business_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ───────── Section 1: Accounting Engine (editorial split) ───────── */}
        <motion.section
          id="section-accounting"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUpStagger}
          className="py-24 md:py-32"
        >
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
              <motion.div variants={fadeUp} className="lg:col-span-5">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
                  {t.section1Eyebrow}
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] mb-6">
                  {t.section1Title}
                </h2>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t.section1Lead}
                </p>
              </motion.div>

              <div className="lg:col-span-7 flex flex-col">
                {t.section1Items.map((item, idx) => (
                  <motion.div
                    key={item.n}
                    variants={fadeUp}
                    className={`group grid grid-cols-[auto_1fr] gap-x-6 md:gap-x-10 py-7 ${
                      idx === 0
                        ? 'border-t border-gray-200 dark:border-gray-800'
                        : ''
                    } border-b border-gray-200 dark:border-gray-800`}
                  >
                    <span className="text-sm font-mono font-medium text-gray-400 dark:text-gray-600 pt-1 tabular-nums">
                      {item.n}
                    </span>
                    <div>
                      <h3 className="text-lg md:text-xl font-semibold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ───────── Section 1.5: Single Source of Truth ───────── */}
        <motion.section
          id="section-ssot"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUpStagger}
          className="pb-24 md:pb-32"
        >
          <div className="container mx-auto px-6 max-w-6xl">
            <motion.div variants={fadeUp} className="max-w-2xl mb-14">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
                {t.ssotEyebrow}
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] mb-6">
                {t.ssotTitle}
              </h2>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                {t.ssotLead}
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>
              <SingleSourceOfTruth lang={lang} />
            </motion.div>
          </div>
        </motion.section>

        {/* ───────── Section 2: Omnichannel (visual + copy split) ───────── */}
        <motion.section
          id="section-omnichannel"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUpStagger}
          className="py-24 md:py-32 bg-gray-50 dark:bg-gray-900/40 border-y border-gray-200 dark:border-gray-800"
        >
          <div className="container mx-auto px-6 max-w-6xl">
            <motion.div variants={fadeUp} className="max-w-2xl mb-14">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
                {t.section2Eyebrow}
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] mb-6">
                {t.section2Title}
              </h2>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                {t.section2Lead}
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <OmnichannelSection />
            </motion.div>
          </div>
        </motion.section>

        {/* ───────── Section 3: Ecommerce Integration ───────── */}
        <motion.section
          id="section-ecommerce"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUpStagger}
          className="py-24 md:py-32"
        >
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              <motion.div variants={fadeUp} className="lg:col-span-6 order-2 lg:order-1">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { name: 'Shopee', src: '/images/ecommerce/Shopee.png' },
                    { name: 'TikTok Shop', src: '/images/ecommerce/Tiktokshop.png' },
                    { name: 'Tokopedia', src: '/images/ecommerce/Tokopedia.png' },
                  ].map(({ name, src }) => (
                    <div
                      key={name}
                      className="aspect-square rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-3 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                    >
                      <Image src={src} alt={name} width={48} height={48} className="object-contain" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="lg:col-span-6 order-1 lg:order-2">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
                  {t.section3Eyebrow}
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] mb-6">
                  {t.section3Title}
                </h2>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t.section3Lead}
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ───────── Health Score CTA ───────── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUpStagger}
          className="py-24 md:py-32 bg-gray-50 dark:bg-gray-900/40 border-y border-gray-200 dark:border-gray-800"
        >
          <div className="container mx-auto px-6 max-w-4xl">
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
                {t.healthEyebrow}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold leading-[1.1] tracking-[-0.02em] mb-5">
                {t.healthTitle}
              </h2>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
                {t.healthLead}
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>
              <HealthScoreCalculator />
              <div className="text-center mt-5">
                <a
                  href="/cek-bisnis"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
                >
                  {t.healthFullLink}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2.5 9.5l7-7M9.5 2.5H5M9.5 2.5v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </a>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ───────── Closing CTA (dark band) ───────── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUpStagger}
          className="bg-gray-950 text-white py-24 md:py-32"
        >
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <motion.p
              variants={fadeUp}
              className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-400 mb-6"
            >
              {t.closingEyebrow}
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.025em] mb-7"
            >
              {t.closingTitle}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base md:text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed"
            >
              {t.closingLead}
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                {t.closingCta}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </motion.section>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="bg-gray-950 text-gray-400 border-t border-gray-800">
        <div className="container mx-auto px-6 max-w-6xl pt-14 pb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 mb-3">
              {t.footerLabel}
            </p>
            <Image
              src="/images/axion-dark.png"
              alt="AXION"
              width={140}
              height={44}
              className="object-contain h-9 w-auto"
            />
          </div>

          <Link
            href="/login"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-200 font-semibold text-sm rounded-full hover:border-gray-500 hover:text-white transition-colors cursor-pointer"
          >
            {t.footerCta}
          </Link>
        </div>

        <div className="border-t border-gray-800">
          <div className="container mx-auto px-6 max-w-6xl py-5 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-3">
            <p>{t.copyright}</p>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1 border border-gray-700 rounded-full overflow-hidden">
                {(['id', 'en'] as const).map((l) => (
                  <Fragment key={l}>
                    <button
                      onClick={() => switchLang(l)}
                      className={`px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        lang === l ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {l.toUpperCase()}
                    </button>
                  </Fragment>
                ))}
              </div>
              <Link href="/blog" className="hover:text-gray-300 transition-colors">
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
              <a href="mailto:imam.isyida@gmail.com" className="hover:text-gray-300 transition-colors">
                imam.isyida@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-500 dark:text-gray-500">
        {label}
      </span>
    </div>
  );
}
