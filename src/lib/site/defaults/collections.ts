/**
 * Isi bawaan kepala halaman /blog dan /market-insights.
 *
 * Diekstrak dari `app/blog/page.tsx` dan `app/market-insights/page.tsx`. Yang
 * dikelola CMS hanya KEPALA halaman (eyebrow, judul, paragraf, metadata SEO).
 *
 * Isi /market-insights sendiri — kurs, suku bunga, berita — datang dari API
 * eksternal lewat `src/lib/marketData/service.ts` dan SENGAJA tidak masuk CMS:
 * itu data hidup, bukan konten yang ditulis.
 */

import type { CollectionIndexContent } from '../types';

export const BLOG_INDEX_DEFAULTS: CollectionIndexContent = {
  eyebrow: 'Blog AXION',
  title: 'Panduan Akuntansi & Keuangan untuk UMKM Indonesia',
  lead: 'Belajar pembukuan, laporan keuangan, dan analisis bisnis dari nol — ditulis khusus untuk pemilik UMKM Indonesia.',
  seo: {
    title: 'Blog AXION — Panduan Akuntansi & Keuangan untuk UMKM Indonesia',
    description:
      'Kumpulan panduan praktis akuntansi, pembukuan, dan keuangan bisnis untuk UMKM Indonesia. Belajar laporan laba rugi, neraca, arus kas, dan analisis ROI.',
  },
};

export const MARKET_INSIGHTS_INDEX_DEFAULTS: CollectionIndexContent = {
  eyebrow: 'Market Insights',
  title: 'Market & Macro Insights for Indonesian Investors',
  lead: 'Kurs, suku bunga global, inflasi, dan berita keuangan terbaru — diagregasi dari Reuters, CNBC, FRED, dan ExchangeRate-API agar setiap keputusan investasi punya konteks data yang up-to-date.',
  seo: {
    title: 'Market Insights — AXION | VC, PE & Macro Data untuk Indonesia',
    description:
      'Pulse pasar global, makroekonomi (suku bunga The Fed, inflasi, kurs USD/IDR), dan berita Venture Capital, Private Equity, dan UMKM Indonesia — semua dalam satu halaman.',
  },
};
