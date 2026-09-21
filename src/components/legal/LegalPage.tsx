import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * Kerangka halaman dokumen legal (Kebijakan Privasi, Syarat & Ketentuan).
 *
 * Server component — halaman legal statis, tidak butuh interaktivitas apa pun.
 * Dipakai bersama supaya kedua dokumen punya tipografi & navigasi identik.
 */
export function LegalPage({
  title,
  effectiveDate,
  intro,
  children,
}: {
  title: string;
  /** Tanggal berlaku, format "6 Agustus 2026". */
  effectiveDate: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/favicon.png"
              alt="AXION"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-bold text-gray-800 dark:text-gray-100">AXION</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            Kembali ke beranda
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Berlaku sejak {effectiveDate}
        </p>
        <p className="mt-6 text-base leading-relaxed text-gray-600 dark:text-gray-300">{intro}</p>

        <div className="mt-10 space-y-10">{children}</div>

        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>
            PT Imam Katalis Ventura · Indonesia ·{' '}
            <a
              href="mailto:support@axionventura.com"
              className="underline hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              support@axionventura.com
            </a>
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200">
              Kebijakan Privasi
            </Link>
            <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-200">
              Syarat &amp; Ketentuan
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

/** Satu bagian bernomor di dokumen legal. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{heading}</h2>
      <div className="space-y-3 text-base leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}

/** Daftar butir dengan gaya seragam. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-5 list-disc marker:text-gray-400 dark:marker:text-gray-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Blok sorot untuk poin yang perlu menonjol (mis. komitmen Limited Use Google).
 *
 * `tone` default 'info' = tampilan netral yang dipakai sejak awal, jadi call
 * site lama tidak perlu diubah. 'warning' dipakai penafian yang konsekuensinya
 * nyata bila terlewat — mis. "AXION bukan jasa akuntansi" di Syarat & Ketentuan.
 */
const CALLOUT_TONES = {
  info: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200',
  warning:
    'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100',
  success:
    'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100',
} as const;

export type CalloutTone = keyof typeof CALLOUT_TONES;

export function Callout({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: CalloutTone;
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 text-base leading-relaxed ${CALLOUT_TONES[tone]}`}
    >
      {children}
    </div>
  );
}
