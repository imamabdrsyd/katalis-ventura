import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { LanguageProvider } from '@/context/LanguageContext';
import { UIPreferencesProvider } from '@/context/UIPreferencesContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { Toaster } from 'sonner';
import { CheckCircle2, CircleAlert, CircleX, Info, Loader2 } from 'lucide-react';
import { getSeoContent } from '@/lib/site/server';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' });

const baseUrl = 'https://axionventura.com';

/**
 * Metadata situs diambil dari Site CMS supaya judul, deskripsi, kata kunci, dan
 * kartu share bisa diubah platform admin tanpa deploy.
 *
 * Yang SENGAJA tetap di kode: `metadataBase`, `icons`, `authors`, `creator`,
 * `publisher`, `robots`, `alternates.canonical`, dan `verification`. Nilainya
 * terikat ke domain dan ke berkas di /public — salah ketik di situ merusak
 * seluruh situs (favicon hilang, URL kanonik salah, halaman ter-deindeks) tanpa
 * gejala yang kelihatan saat menyunting teks.
 *
 * `getSeoContent()` selalu mengembalikan dokumen utuh (default kode di-merge
 * dengan isi DB), jadi tidak ada field yang bisa kosong di sini.
 */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoContent();

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: seo.siteTitle,
      template: seo.titleTemplate,
    },
    description: seo.description,
    keywords: seo.keywords,
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
      title: seo.openGraph.title,
      description: seo.openGraph.description,
      images: [
        {
          url: seo.openGraph.imageUrl,
          width: 1200,
          height: 630,
          alt: seo.openGraph.imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.twitter.title,
      description: seo.twitter.description,
      images: [seo.openGraph.imageUrl],
      creator: seo.twitter.creator,
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
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Gambar sampai ke tepi layar ber-notch (webview/PWA) — padding diatur
  // via env(safe-area-inset-*) di layout, bukan dibiarkan browser meletterbox.
  viewportFit: 'cover',
  // Keyboard muncul → layout viewport ikut mengecil, sehingga input/panel
  // fixed-bottom (mis. chat AI) tetap terlihat di atas keyboard Android.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F8FA' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
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
            <ThemeProvider>
              <UIPreferencesProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </UIPreferencesProvider>
              <Toaster
                position="top-center"
                closeButton
                mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
                icons={{
                  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
                  error: <CircleX className="h-5 w-5 text-red-500" aria-hidden="true" />,
                  warning: <CircleAlert className="h-5 w-5 text-amber-500" aria-hidden="true" />,
                  info: <Info className="h-5 w-5 text-sky-500" aria-hidden="true" />,
                  loading: <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-hidden="true" />,
                }}
                toastOptions={{
                  style: {
                    background: '#ffffff',
                    color: '#374151',
                    border: '1px solid #f3f4f6',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
                  },
                  classNames: {
                    title: 'text-sm font-medium text-gray-700',
                    description: 'text-xs text-gray-400',
                    closeButton: '!left-auto !right-2 !top-2 !translate-x-0 bg-white text-gray-400 border-gray-100',
                  },
                }}
              />
            </ThemeProvider>
          </LanguageProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
