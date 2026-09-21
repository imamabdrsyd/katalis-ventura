/**
 * Metadata SEO bawaan — diekstrak dari `app/layout.tsx`.
 *
 * Yang SENGAJA tidak ikut dikelola CMS: `metadataBase`, `icons`, `authors`,
 * `creator`, `publisher`, dan `robots`. Nilainya terikat ke domain dan ke berkas
 * di /public; salah ketik di situ merusak seluruh situs (favicon hilang, URL
 * kanonik salah, halaman ter-deindeks) tanpa gejala yang kelihatan saat
 * menyunting. Field-field itu tetap di kode dan hanya berubah lewat deploy.
 */

import type { SeoContent } from '../types';

export const SEO_DEFAULTS: SeoContent = {
  siteTitle: 'AXION — Financial Hub untuk Pengelola Bisnis dan Investor Indonesia',
  titleTemplate: '%s | AXION',
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
  openGraph: {
    title: 'AXION — Financial Hub untuk Pengelola Bisnis dan Investor Indonesia',
    description:
      'Kelola keuangan bisnis secara profesional dengan double-entry bookkeeping, laporan otomatis, dan transparansi data untuk investor. Gratis untuk bisnis pertama.',
    imageUrl: '/images/axion.png',
    imageAlt: 'AXION — Platform Akuntansi untuk UKM Indonesia',
  },
  twitter: {
    title: 'AXION — Financial Hub untuk Pengelola Bisnis dan Investor Indonesia',
    description:
      'Kelola keuangan bisnis secara profesional. Laporan laba rugi, neraca, arus kas otomatis untuk UKM Indonesia.',
    creator: '@imamabdrsyd',
  },
};
