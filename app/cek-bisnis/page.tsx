import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import HealthScoreCalculator from '@/components/landing/HealthScoreCalculator';

export const metadata: Metadata = {
  title: 'Cek Kesehatan Keuangan Bisnis Gratis',
  description:
    'Hitung skor kesehatan keuangan bisnismu dalam 10 detik. Input 3 angka, dapat skor 0–100 plus rekomendasi spesifik. Gratis, tanpa daftar.',
  openGraph: {
    title: 'Cek Kesehatan Keuangan Bisnis — AXION',
    description: 'Hitung skor kesehatan keuangan bisnismu dalam 10 detik. Gratis, tanpa daftar.',
    url: 'https://axionventura.com/cek-bisnis',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cek Kesehatan Keuangan Bisnis — AXION',
    description: 'Hitung skor kesehatan keuangan bisnismu dalam 10 detik. Gratis, tanpa daftar.',
  },
};

export default function CekBisnisPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-12 sm:py-16">
      {/* Top nav */}
      <div className="w-full max-w-4xl mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          axionventura.com
        </Link>
        <div className="flex items-center gap-1.5">
          <Image
            src="/images/favicon-dark.png"
            alt="AXION"
            width={20}
            height={20}
            className="object-contain opacity-70"
          />
          <span className="text-xs font-bold tracking-[0.1em] text-slate-500 uppercase">AXION</span>
        </div>
      </div>

      {/* Calculator */}
      <div className="w-full max-w-4xl">
        <HealthScoreCalculator showShareButtons />
      </div>

      {/* Footer note */}
      <p className="mt-8 text-center text-xs text-slate-600">
        Kalkulator ini tidak menyimpan data apapun. Semua kalkulasi dilakukan di browser-mu.
      </p>
    </main>
  );
}
