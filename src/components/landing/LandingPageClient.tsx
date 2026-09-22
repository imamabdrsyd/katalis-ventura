'use client';

/**
 * Renderer landing page.
 *
 * Sebelumnya ini isi `app/page.tsx` dengan objek `content` hardcode di dalamnya.
 * Sekarang seluruh teks, urutan section, flag on/off, target link, dan sumber
 * gambar datang dari props `content` — disuplai server dari Site CMS dan sudah
 * di-merge di atas default kode, jadi properti di sini selalu terisi.
 *
 * Yang TETAP di kode dan tidak dikelola CMS: tata letak, animasi, warna, dan
 * komponen interaktif (SingleSourceOfTruth, OmnichannelSection,
 * HealthScoreCalculator). Itu batas pola "section slot" — lihat
 * `src/lib/site/types.ts`.
 */

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { OmnichannelSection } from '@/components/omnichannel/OmnichannelSection';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import HealthScoreCalculator from '@/components/landing/HealthScoreCalculator';
import SingleSourceOfTruth from '@/components/landing/SingleSourceOfTruth';
import {
  LANDING_SECTION_ANCHOR,
  type LandingContent,
  type LandingSectionKey,
  type Locale,
  type LocalizedText,
} from '@/lib/site/types';
import { hasLiveTarget } from '@/lib/site/landingNav';

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

/**
 * Kelas pembungkus per section.
 *
 * Sengaja diikat ke KEY section, bukan ke posisinya. Konsekuensinya: kalau admin
 * menukar urutan sampai dua section bertinta (omnichannel & health) jadi
 * berdampingan, keduanya akan tampil sebagai satu blok abu panjang. Itu
 * trade-off yang dipilih sadar — mengikat tinta ke posisi (mis. ganjil/genap)
 * akan mengubah tampilan yang sekarang, karena urutan default bukan alternasi.
 */
const SECTION_SHELL: Record<LandingSectionKey, string> = {
  accounting: 'py-24 md:py-32',
  ssot: 'pb-24 md:pb-32',
  omnichannel:
    'py-24 md:py-32 bg-gray-50 dark:bg-gray-900/40 border-y border-gray-200 dark:border-gray-800',
  ecommerce: 'py-24 md:py-32',
  health:
    'py-24 md:py-32 bg-gray-50 dark:bg-gray-900/40 border-y border-gray-200 dark:border-gray-800',
};

export default function LandingPageClient({ content }: { content: LandingContent }) {
  const [stats, setStats] = useState<Stats>({ users: 0, businesses: 0, businessLogos: [] });
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<Locale>('id');
  const reduce = useReducedMotion();

  useEffect(() => {
    const saved = localStorage.getItem('axion_lang') as Locale | null;
    if (saved === 'id' || saved === 'en') setLang(saved);
  }, []);

  const switchLang = (l: Locale) => {
    setLang(l);
    localStorage.setItem('axion_lang', l);
  };

  /** Ambil satu string dalam bahasa aktif. */
  const tx = (value: LocalizedText) => value[lang];

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

  const { hero, nav, trustStrip, sections, closing, footer } = content;
  const heroTitle1Words = tx(hero.title1).split(' ');
  const heroTitle2Words = tx(hero.title2).split(' ');

  // Menu yang menunjuk ke section tersembunyi ikut hilang — lihat `landingNav.ts`.
  const navItems = nav.items.filter(
    (item) => item.visible && hasLiveTarget(content, item.href)
  );

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
              {navItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  {tx(item.label)}
                </a>
              ))}
            </nav>
            <span className="w-px h-5 bg-gray-200 dark:bg-gray-800" />
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-full bg-gray-900 text-white hover:bg-primary-600 dark:bg-white dark:text-gray-900 dark:hover:bg-primary-500 dark:hover:text-white transition-colors cursor-pointer"
            >
              {tx(nav.loginLabel)}
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
                <motion.div initial="hidden" animate="visible" variants={fadeUpStagger}>
                  <motion.p
                    variants={fadeUp}
                    className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-6"
                  >
                    {tx(hero.eyebrow)}
                  </motion.p>

                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.98] tracking-[-0.03em] mb-7">
                    <span className="block overflow-hidden">
                      {heroTitle1Words.map((word, i) => (
                        <motion.span
                          key={`t1-${i}`}
                          variants={reduce ? fadeUp : heroWord}
                          className="inline-block mr-[0.25em]"
                        >
                          {word}
                        </motion.span>
                      ))}
                    </span>
                    <span className="block overflow-hidden text-gray-400 dark:text-gray-600">
                      {heroTitle2Words.map((word, i) => (
                        <motion.span
                          key={`t2-${i}`}
                          variants={reduce ? fadeUp : heroWord}
                          className="inline-block mr-[0.25em]"
                        >
                          {word}
                        </motion.span>
                      ))}
                    </span>
                  </h1>

                  <motion.p
                    variants={fadeUp}
                    className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed mb-10"
                  >
                    {tx(hero.subtitle)}
                  </motion.p>

                  <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4">
                    <Link
                      href={hero.primaryCta.href}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-primary-600 dark:bg-white dark:text-gray-900 dark:hover:bg-primary-500 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {tx(hero.primaryCta.label)}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                        <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>

                    {/* Tombol kedua hero biasanya menunjuk ke section ("Lihat
                        cara kerjanya" → #section-ssot). Kalau section tujuannya
                        disembunyikan, tombolnya ikut hilang — tombol yang diklik
                        lalu tidak terjadi apa-apa lebih buruk daripada tidak ada
                        tombol sama sekali. */}
                    {hasLiveTarget(content, hero.secondaryCta.href) && (
                      <a
                        href={hero.secondaryCta.href}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group cursor-pointer"
                      >
                        {tx(hero.secondaryCta.label)}
                        <span className="transition-transform group-hover:translate-x-1">↓</span>
                      </a>
                    )}
                  </motion.div>
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
                    src={hero.imageLight}
                    alt="AXION dashboard preview"
                    width={2880}
                    height={1794}
                    priority
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="w-full h-auto block dark:hidden"
                  />
                  <Image
                    src={hero.imageDark}
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

        {/* ───────── Trust strip ─────────
            Angkanya dari /api/stats, bukan dari CMS — yang bisa disunting cuma
            labelnya. Marquee tetap butuh minimal satu logo; bisnis mana yang
            muncul diatur lewat toggle show_in_logo_slide di halaman bisnis. */}
        {trustStrip.visible && stats.businessLogos.length > 0 && (
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
                  {tx(trustStrip.eyebrow)}
                </p>
                <div className="flex items-center gap-8">
                  <Stat value={loading ? '—' : String(stats.businesses)} label={tx(trustStrip.businessesLabel)} />
                  <span className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
                  <Stat value={loading ? '—' : String(stats.users)} label={tx(trustStrip.usersLabel)} />
                  <span className="w-px h-8 bg-gray-200 dark:bg-gray-800" />
                  <Stat value="100%" label={tx(trustStrip.privacyLabel)} />
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

        {/* ───────── Section bergilir sesuai sectionOrder ───────── */}
        {content.sectionOrder.map((key) => {
          const section = sections[key];
          if (!section.visible) return null;

          const anchor = LANDING_SECTION_ANCHOR[key] ?? undefined;

          return (
            <motion.section
              key={key}
              id={anchor}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={fadeUpStagger}
              className={SECTION_SHELL[key]}
            >
              {key === 'accounting' ? (
                <div className="container mx-auto px-6 max-w-6xl">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                    <motion.div variants={fadeUp} className="lg:col-span-5">
                      <SectionEyebrow>{tx(section.eyebrow)}</SectionEyebrow>
                      <SectionTitle>{tx(section.title)}</SectionTitle>
                      <SectionLead>{tx(section.lead)}</SectionLead>
                    </motion.div>

                    <div className="lg:col-span-7 flex flex-col">
                      {sections.accounting.items.map((item, idx) => (
                        <motion.div
                          key={`${item.n}-${idx}`}
                          variants={fadeUp}
                          className={`group grid grid-cols-[auto_1fr] gap-x-6 md:gap-x-10 py-7 ${
                            idx === 0 ? 'border-t border-gray-200 dark:border-gray-800' : ''
                          } border-b border-gray-200 dark:border-gray-800`}
                        >
                          <span className="text-sm font-mono font-medium text-gray-400 dark:text-gray-600 pt-1 tabular-nums">
                            {item.n}
                          </span>
                          <div>
                            <h3 className="text-lg md:text-xl font-semibold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {tx(item.title)}
                            </h3>
                            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                              {tx(item.body)}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : key === 'ssot' ? (
                <div className="container mx-auto px-6 max-w-6xl">
                  <motion.div variants={fadeUp} className="max-w-2xl mb-14">
                    <SectionEyebrow>{tx(section.eyebrow)}</SectionEyebrow>
                    <SectionTitle>{tx(section.title)}</SectionTitle>
                    <SectionLead>{tx(section.lead)}</SectionLead>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <SingleSourceOfTruth lang={lang} />
                  </motion.div>
                </div>
              ) : key === 'omnichannel' ? (
                <div className="container mx-auto px-6 max-w-6xl">
                  <motion.div variants={fadeUp} className="max-w-2xl mb-14">
                    <SectionEyebrow>{tx(section.eyebrow)}</SectionEyebrow>
                    <SectionTitle>{tx(section.title)}</SectionTitle>
                    <SectionLead>{tx(section.lead)}</SectionLead>
                  </motion.div>

                  <motion.div
                    variants={fadeUp}
                    className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden"
                  >
                    <OmnichannelSection />
                  </motion.div>
                </div>
              ) : key === 'ecommerce' ? (
                <div className="container mx-auto px-6 max-w-6xl">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    <motion.div variants={fadeUp} className="lg:col-span-6 order-2 lg:order-1">
                      <div className="grid grid-cols-3 gap-4">
                        {sections.ecommerce.logos.map(({ name, src }) => (
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
                      <SectionEyebrow>{tx(section.eyebrow)}</SectionEyebrow>
                      <SectionTitle>{tx(section.title)}</SectionTitle>
                      <SectionLead>{tx(section.lead)}</SectionLead>
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="container mx-auto px-6 max-w-4xl">
                  <motion.div variants={fadeUp} className="text-center mb-12">
                    <SectionEyebrow>{tx(section.eyebrow)}</SectionEyebrow>
                    <h2 className="text-3xl md:text-4xl font-bold leading-[1.1] tracking-[-0.02em] mb-5">
                      {tx(section.title)}
                    </h2>
                    <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
                      {tx(section.lead)}
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <HealthScoreCalculator />
                    <div className="text-center mt-5">
                      <a
                        href="/cek-bisnis"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
                      >
                        {tx(sections.health.fullLinkLabel)}
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                          <path d="M2.5 9.5l7-7M9.5 2.5H5M9.5 2.5v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </a>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.section>
          );
        })}

        {/* ───────── Closing CTA (dark band) ───────── */}
        {closing.visible && (
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
                {tx(closing.eyebrow)}
              </motion.p>
              <motion.h2
                variants={fadeUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.025em] mb-7"
              >
                {tx(closing.title)}
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-base md:text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed"
              >
                {tx(closing.lead)}
              </motion.p>
              <motion.div variants={fadeUp}>
                <Link
                  href={closing.cta.href}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  {tx(closing.cta.label)}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </motion.div>
            </div>
          </motion.section>
        )}
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="bg-gray-950 text-gray-400 border-t border-gray-800">
        <div className="container mx-auto px-6 max-w-6xl pt-14 pb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 mb-3">
              {tx(footer.label)}
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
            href={footer.cta.href}
            className="shrink-0 inline-flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-200 font-semibold text-sm rounded-full hover:border-gray-500 hover:text-white transition-colors cursor-pointer"
          >
            {tx(footer.cta.label)}
          </Link>
        </div>

        <div className="border-t border-gray-800">
          <div className="container mx-auto px-6 max-w-6xl py-5 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-3">
            <p>{tx(footer.copyright)}</p>
            <div className="flex items-center gap-5">
              {/* Link legal wajib terjangkau dari halaman utama — Google
                  memverifikasinya saat consent screen OAuth dipublish. Karena
                  itu target /privacy & /terms tidak ikut dikelola CMS, hanya
                  labelnya. */}
              <div className="flex items-center gap-4 text-xs">
                <Link href="/privacy" className="hover:text-gray-300 transition-colors">
                  {tx(footer.privacyLabel)}
                </Link>
                <Link href="/terms" className="hover:text-gray-300 transition-colors">
                  {tx(footer.termsLabel)}
                </Link>
              </div>
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
                {tx(footer.blogLabel)}
              </Link>
              {footer.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  {...(link.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="hover:text-gray-300 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400 mb-5">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] mb-6">
      {children}
    </h2>
  );
}

function SectionLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
      {children}
    </p>
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
