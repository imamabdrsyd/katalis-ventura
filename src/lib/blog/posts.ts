export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  category: string;
  readingMinutes: number;
  keywords: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'cara-buat-laporan-laba-rugi-umkm',
    title: 'Cara Membuat Laporan Laba Rugi untuk UMKM (Lengkap dengan Contoh)',
    description:
      'Panduan lengkap membuat laporan laba rugi untuk UMKM Indonesia: pengertian, komponen, langkah-langkah, contoh tabel, dan kesalahan umum yang harus dihindari.',
    publishedAt: '2026-05-03',
    updatedAt: '2026-05-03',
    author: 'Tim AXION',
    category: 'Akuntansi UMKM',
    readingMinutes: 8,
    keywords: [
      'laporan laba rugi UMKM',
      'cara membuat laporan laba rugi',
      'contoh laporan laba rugi sederhana',
      'income statement UMKM',
      'akuntansi UMKM',
      'pembukuan UMKM',
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
