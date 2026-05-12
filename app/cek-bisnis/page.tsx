import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import HealthScoreCalculator from '@/components/landing/HealthScoreCalculator';

const pageUrl = 'https://axionventura.com/cek-bisnis';
const pageTitle = 'Cek Kesehatan Keuangan Bisnis Gratis — Skor 0–100 dalam 10 Detik';
const pageDescription =
  'Kalkulator kesehatan keuangan bisnis gratis. Input 3 angka (pendapatan, pengeluaran, saldo kas) dan dapatkan skor 0–100 plus rekomendasi spesifik untuk UMKM Indonesia. Tidak perlu daftar.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: [
    'cek kesehatan keuangan bisnis',
    'kalkulator keuangan bisnis gratis',
    'skor keuangan UMKM',
    'cara cek keuangan bisnis',
    'kesehatan finansial bisnis',
    'analisis keuangan bisnis sederhana',
    'kalkulator laba rugi UMKM',
    'cek bisnis sehat',
    'indikator kesehatan bisnis',
    'profit margin bisnis Indonesia',
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    type: 'website',
    siteName: 'AXION',
    locale: 'id_ID',
    images: [
      {
        url: '/images/axion.png',
        width: 1200,
        height: 630,
        alt: 'Cek Kesehatan Keuangan Bisnis — AXION',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
    images: ['/images/axion.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${pageUrl}#app`,
      name: 'Kalkulator Kesehatan Keuangan Bisnis',
      description: pageDescription,
      url: pageUrl,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'IDR',
      },
      provider: {
        '@type': 'Organization',
        name: 'AXION',
        url: 'https://axionventura.com',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Bagaimana cara menghitung kesehatan keuangan bisnis?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Masukkan 3 angka: pendapatan bulan ini, total pengeluaran bulan ini, dan saldo kas saat ini. Kalkulator akan otomatis menghitung skor 0–100 berdasarkan profit margin, burn rate, dan likuiditas bisnis kamu.',
          },
        },
        {
          '@type': 'Question',
          name: 'Apakah data saya tersimpan di server?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Tidak. Semua kalkulasi dilakukan langsung di browser kamu. Data tidak dikirim ke server manapun.',
          },
        },
        {
          '@type': 'Question',
          name: 'Apa arti skor kesehatan keuangan bisnis?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Skor 80–100 berarti bisnis dalam kondisi sehat. Skor 60–79 berarti cukup baik tapi ada ruang perbaikan. Skor di bawah 60 berarti perlu perhatian khusus pada profitabilitas atau likuiditas.',
          },
        },
      ],
    },
  ],
};

export default function CekBisnisPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-12 sm:py-16">
      <Script
        id="json-ld-cek-bisnis"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
        <div className="flex items-center">
          <Image
            src="/images/axion-dark.png"
            alt="AXION"
            width={80}
            height={24}
            className="object-contain opacity-60"
          />
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
