/**
 * Isi bawaan landing page.
 *
 * Diekstrak apa adanya dari objek `content` yang sebelumnya hardcode di
 * `app/page.tsx`. Dua perannya:
 *
 *   1. FALLBACK. Halaman publik dirender dari `merge(LANDING_DEFAULTS, dbContent)`,
 *      jadi selama baris `site_pages` belum dipublikasikan — atau ada key yang
 *      hilang karena skema berkembang — tampilan tetap sama seperti sekarang.
 *   2. TITIK AWAL EDITOR. Draft pertama di /admin diisi dari sini, sehingga
 *      admin menyunting teks yang benar-benar sedang tayang, bukan form kosong.
 *
 * Karena ini fallback, JANGAN mengosongkan nilai di sini untuk "menghapus"
 * sesuatu dari landing page — kosongkan lewat /admin. Menghapus key di sini
 * malah membuat nilai dari DB ikut diabaikan (lihat `mergeSiteContent`).
 */

import type { LandingContent } from '../types';

export const LANDING_DEFAULTS: LandingContent = {
  nav: {
    items: [
      {
        key: 'accounting',
        label: { id: 'Accounting Engine', en: 'Accounting Engine' },
        href: '#section-accounting',
        visible: true,
      },
      {
        key: 'ssot',
        label: { id: 'Single Source of Truth', en: 'Single Source of Truth' },
        href: '#section-ssot',
        visible: true,
      },
      {
        key: 'omnichannel',
        label: { id: 'Omnichannel', en: 'Omnichannel' },
        href: '#section-omnichannel',
        visible: true,
      },
      {
        key: 'ecommerce',
        label: { id: 'Ecommerce Integration', en: 'Ecommerce Integration' },
        href: '#section-ecommerce',
        visible: true,
      },
    ],
    loginLabel: { id: 'Limited Partner', en: 'Limited Partner' },
  },

  hero: {
    eyebrow: { id: 'Accounting Engine', en: 'Accounting Engine' },
    title1: { id: 'People lie,', en: 'People lie,' },
    title2: { id: "numbers don't.", en: "numbers don't." },
    subtitle: {
      id: 'Ada cerita di balik angka bisnis kamu entah kamu dengerin atau engga. AXION bantu kamu nangkep cerita itu, biar kamu tinggal ambil setiap keputusan berdasarkan data, bukan dugaan.',
      en: "The numbers in your business are telling a story — whether you're listening or not. AXION helps you listen, so every decision is built on data, not guesswork.",
    },
    primaryCta: {
      label: { id: 'Enter AXION', en: 'Enter AXION' },
      href: '/login',
    },
    secondaryCta: {
      label: { id: 'Lihat cara kerjanya', en: 'See how it works' },
      href: '#section-ssot',
    },
    imageLight: '/images/landing-page-2.png',
    imageDark: '/images/landing-page-dark.png',
  },

  trustStrip: {
    visible: true,
    eyebrow: { id: 'AXION Partners', en: 'AXION Partners' },
    usersLabel: { id: 'Pengguna', en: 'Users' },
    businessesLabel: { id: 'Bisnis', en: 'Businesses' },
    privacyLabel: { id: 'Data Privacy', en: 'Data Privacy' },
  },

  sectionOrder: ['accounting', 'ssot', 'omnichannel', 'ecommerce', 'health'],

  sections: {
    accounting: {
      visible: true,
      eyebrow: { id: 'Pembukuan otomatis', en: 'Automatic bookkeeping' },
      title: {
        id: 'Pembukuan double-entry, tanpa effort spreadsheet.',
        en: 'Double-entry accounting, without the spreadsheet effort.',
      },
      lead: {
        id: 'Setiap transaksi mengalir ke buku besar, jurnal, dan laporan secara otomatis. Tutup buku tidak lagi menunggu akhir bulan — kapan saja, status keuangan tersedia.',
        en: 'Every transaction flows into the ledger, journal, and reports automatically. Closing the books no longer waits for month-end — your financial picture is always available.',
      },
      items: [
        {
          n: '01',
          title: {
            id: 'Jurnal & buku besar otomatis',
            en: 'Auto-generated journals & ledgers',
          },
          body: {
            id: 'Input sekali, sistem yang menyusun jurnal, posting ke buku besar, dan menghitung saldo tiap akun.',
            en: 'Enter once. The system handles journal entries, posting, and account balances.',
          },
        },
        {
          n: '02',
          title: {
            id: 'Laporan keuangan real-time',
            en: 'Real-time financial reports',
          },
          body: {
            id: 'Neraca, laba rugi, dan arus kas selalu terkini — bukan snapshot bulan kemarin.',
            en: 'Balance sheet, income statement, and cash flow always current — not last month’s snapshot.',
          },
        },
        {
          n: '03',
          title: { id: 'Audit trail penuh', en: 'Full audit trail' },
          body: {
            id: 'Setiap perubahan tercatat: siapa, kapan, dari nilai apa ke nilai apa. Tidak ada angka yang hilang diam-diam.',
            en: 'Every change recorded: who, when, from what value to what value. No silent edits.',
          },
        },
      ],
    },

    ssot: {
      visible: true,
      eyebrow: { id: 'Single Source of Truth', en: 'Single Source of Truth' },
      title: {
        id: 'Catat sekali, semua laporan otomatis.',
        en: 'Record once, every report updates.',
      },
      lead: {
        id: 'Satu jurnal mengalir ke laba rugi, neraca, arus kas, dan dashboard investor — tidak ada rekonsiliasi manual, tidak ada angka yang berbeda antar laporan.',
        en: 'One journal feeds the income statement, balance sheet, cash flow, and investor dashboard — no manual reconciliation, no numbers that disagree between reports.',
      },
    },

    omnichannel: {
      visible: true,
      eyebrow: { id: 'Omnichannel inventory', en: 'Omnichannel inventory' },
      title: { id: 'Satu stok, semua channel.', en: 'One stock, every channel.' },
      lead: {
        id: 'Stok di toko fisik, website, dan marketplace dipantau dari satu tempat. Tidak ada overselling karena data tidak sinkron, tidak ada duplikasi entri.',
        en: 'Stock across your physical store, website, and marketplaces is monitored from one place. No overselling from out-of-sync data, no duplicated entries.',
      },
    },

    ecommerce: {
      visible: true,
      eyebrow: { id: 'Ecommerce integration', en: 'Ecommerce integration' },
      title: {
        id: 'Order masuk, buku langsung tercatat.',
        en: 'Order in, books updated.',
      },
      lead: {
        id: 'Hubungkan Tokopedia, Shopee, dan TikTok Shop. Setiap order otomatis masuk ke pembukuan — tanpa input manual, tanpa selisih di akhir bulan.',
        en: 'Connect Tokopedia, Shopee, and TikTok Shop. Every order is recorded in your books automatically — no manual input, no month-end discrepancies.',
      },
      logos: [
        { name: 'Shopee', src: '/images/ecommerce/Shopee.png' },
        { name: 'TikTok Shop', src: '/images/ecommerce/Tiktokshop.png' },
        { name: 'Tokopedia', src: '/images/ecommerce/Tokopedia.png' },
      ],
    },

    health: {
      visible: true,
      eyebrow: { id: 'Tool gratis', en: 'Free tool' },
      title: {
        id: 'Cek skor kesehatan bisnis Anda.',
        en: 'Check your business health score.',
      },
      lead: {
        id: 'Tiga angka, dua menit, satu skor. Tahu posisi bisnis Anda sebelum bicara dengan investor.',
        en: 'Three numbers, two minutes, one score. Know where you stand before you talk to investors.',
      },
      fullLinkLabel: { id: 'Buka di halaman penuh', en: 'Open in full page' },
    },
  },

  closing: {
    visible: true,
    eyebrow: { id: 'Mulai sekarang', en: 'Start now' },
    title: { id: 'Kelola bisnis lebih cerdas.', en: 'Run your business smarter.' },
    lead: {
      id: 'Mulai dengan bisnis pertama kamu. Pindah dari spreadsheet dalam hitungan menit.',
      en: 'Start with your first business. Move off spreadsheets in minutes.',
    },
    cta: {
      label: { id: 'Buka akun AXION', en: 'Open AXION account' },
      href: '/login',
    },
  },

  footer: {
    label: {
      id: 'Financial Hub untuk Owner & Investor',
      en: 'Financial Hub for Owner & Investor',
    },
    cta: {
      label: { id: 'Limited Partner Login', en: 'Limited Partner Login' },
      href: '/login',
    },
    copyright: {
      id: '© 2026 PT Imam Katalis Ventura. All rights reserved.',
      en: '© 2026 PT Imam Katalis Ventura. All rights reserved.',
    },
    privacyLabel: { id: 'Kebijakan Privasi', en: 'Privacy Policy' },
    termsLabel: { id: 'Syarat & Ketentuan', en: 'Terms of Service' },
    blogLabel: { id: 'Blog', en: 'Blog' },
    links: [
      { label: '@imamabdrsyd', href: 'https://instagram.com/imamabdrsyd' },
      { label: 'imam.isyida@gmail.com', href: 'mailto:imam.isyida@gmail.com' },
    ],
  },
};
