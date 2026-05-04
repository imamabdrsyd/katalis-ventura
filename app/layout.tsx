import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { LanguageProvider } from '@/context/LanguageContext';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] });

const baseUrl = 'https://axionventura.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'AXION — Platform Akuntansi Double-Entry untuk UKM Indonesia',
    template: '%s | AXION',
  },
  description:
    'AXION adalah platform akuntansi double-entry untuk UKM Indonesia. Kelola laporan laba rugi, neraca, arus kas, dan pantau ROI bisnis secara real-time. Gratis untuk bisnis pertama.',
  keywords: [
    'aplikasi akuntansi UKM',
    'pembukuan double-entry Indonesia',
    'laporan keuangan bisnis',
    'software akuntansi gratis',
    'laporan laba rugi otomatis',
    'neraca bisnis UMKM',
    'arus kas bisnis',
    'akuntansi bisnis kuliner',
    'akuntansi agribusiness',
    'ROI bisnis Indonesia',
    'AXION accounting',
    'Katalis Ventura',
  ],
  authors: [{ name: 'PT Imam Katalis Ventura', url: baseUrl }],
  creator: 'PT Imam Katalis Ventura',
  publisher: 'PT Imam Katalis Ventura',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: baseUrl,
    siteName: 'AXION',
    title: 'AXION — Platform Akuntansi Double-Entry untuk UKM Indonesia',
    description:
      'Kelola keuangan bisnis secara profesional dengan double-entry bookkeeping, laporan otomatis, dan transparansi data untuk investor. Gratis untuk bisnis pertama.',
    images: [
      {
        url: '/images/axion.png',
        width: 1200,
        height: 630,
        alt: 'AXION — Platform Akuntansi untuk UKM Indonesia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AXION — Platform Akuntansi Double-Entry untuk UKM Indonesia',
    description:
      'Kelola keuangan bisnis secara profesional. Laporan laba rugi, neraca, arus kas otomatis untuk UKM Indonesia.',
    images: ['/images/axion.png'],
    creator: '@imamabdrsyd',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/favicon-192.png',
  },
  alternates: {
    canonical: baseUrl,
  },
  verification: {
    google: 'O3hPVAfUSqZM-QFwWeTfiCrFojl9-PhXn1rHhOwP1Ac',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AXION',
  alternateName: 'Katalis Ventura',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Accounting Software',
  operatingSystem: 'Web',
  url: baseUrl,
  description:
    'Platform akuntansi double-entry untuk UKM Indonesia. Laporan laba rugi, neraca, arus kas, dan analisis ROI secara real-time.',
  inLanguage: 'id-ID',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'IDR',
    description: 'Gratis untuk bisnis pertama',
  },
  featureList: [
    'Double-entry bookkeeping',
    'Laporan laba rugi otomatis',
    'Neraca (balance sheet)',
    'Laporan arus kas',
    'Analisis ROI',
    'Scenario modeling',
    'General ledger',
    'Multi-business management',
    'Investor dashboard',
    'Omnichannel link-in-bio',
  ],
  creator: {
    '@type': 'Organization',
    name: 'PT Imam Katalis Ventura',
    url: baseUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={plusJakartaSans.className}>
        <QueryProvider>
          <LanguageProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </LanguageProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
