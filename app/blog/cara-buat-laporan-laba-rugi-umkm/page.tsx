import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Calendar, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getPostBySlug } from '@/lib/blog/posts';

const slug = 'cara-buat-laporan-laba-rugi-umkm';
const post = getPostBySlug(slug)!;
const url = `https://axionventura.com/blog/${slug}`;

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  keywords: post.keywords,
  alternates: { canonical: url },
  openGraph: {
    title: post.title,
    description: post.description,
    url,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: [post.author],
    tags: post.keywords,
  },
  twitter: {
    card: 'summary_large_image',
    title: post.title,
    description: post.description,
  },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  description: post.description,
  author: { '@type': 'Organization', name: post.author, url: 'https://axionventura.com' },
  publisher: {
    '@type': 'Organization',
    name: 'AXION',
    logo: { '@type': 'ImageObject', url: 'https://axionventura.com/images/axion.png' },
  },
  datePublished: post.publishedAt,
  dateModified: post.updatedAt,
  mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  inLanguage: 'id-ID',
  keywords: post.keywords.join(', '),
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Apa itu laporan laba rugi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Laporan laba rugi (income statement) adalah laporan keuangan yang menunjukkan pendapatan, beban, dan laba atau rugi suatu bisnis dalam periode tertentu (bulanan, kuartalan, atau tahunan). Laporan ini menjawab pertanyaan: apakah bisnis untung atau rugi?',
      },
    },
    {
      '@type': 'Question',
      name: 'Apa bedanya laba kotor, laba operasi, dan laba bersih?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Laba kotor = Pendapatan dikurangi HPP (Harga Pokok Penjualan). Laba operasi = Laba kotor dikurangi beban operasional. Laba bersih = Laba operasi dikurangi bunga dan pajak. Laba bersih adalah angka final yang menunjukkan keuntungan riil bisnis.',
      },
    },
    {
      '@type': 'Question',
      name: 'Apakah UMKM wajib membuat laporan laba rugi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Secara hukum, UMKM tidak diwajibkan oleh pemerintah untuk membuat laporan laba rugi formal. Namun secara praktik bisnis, laporan ini sangat penting untuk: mengetahui kesehatan finansial, mengajukan pinjaman bank, menarik investor, dan menghitung pajak penghasilan dengan benar.',
      },
    },
    {
      '@type': 'Question',
      name: 'Berapa sering laporan laba rugi harus dibuat?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Idealnya laporan laba rugi dibuat setiap bulan untuk memantau performa bisnis secara real-time. Untuk pelaporan pajak, laporan tahunan wajib dibuat. Bisnis yang baru berdiri sebaiknya cek laporan laba rugi mingguan agar bisa cepat tanggap jika ada masalah arus kas.',
      },
    },
    {
      '@type': 'Question',
      name: 'Bagaimana cara membuat laporan laba rugi otomatis?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cara tercepat adalah menggunakan software akuntansi double-entry seperti AXION. Cukup catat transaksi harian (penjualan, pembelian, beban), software akan otomatis menghasilkan laporan laba rugi lengkap dengan margin kotor, margin operasi, dan laba bersih — tanpa perlu kalkulasi manual.',
      },
    },
  ],
};

export default function ArticlePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <article className="container mx-auto px-6 py-12 max-w-3xl">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          <Link href="/blog" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            Blog
          </Link>
          <span className="mx-2">/</span>
          <span>{post.category}</span>
        </nav>

        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-semibold">
              {post.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.readingMinutes} menit baca
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-4">
            {post.title}
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            {post.description}
          </p>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-li:text-gray-700 dark:prose-li:text-gray-300">
          <h2 id="apa-itu-laporan-laba-rugi">Apa Itu Laporan Laba Rugi?</h2>
          <p>
            <strong>Laporan laba rugi</strong> (atau <em>income statement</em>) adalah salah satu dari tiga laporan keuangan utama yang menunjukkan kinerja finansial bisnis dalam periode tertentu — biasanya bulanan, kuartalan, atau tahunan.
          </p>
          <p>
            Sederhananya, laporan laba rugi menjawab satu pertanyaan paling penting bagi pemilik bisnis: <strong>apakah bisnis saya untung atau rugi?</strong>
          </p>
          <p>
            Rumus dasarnya cukup simpel:
          </p>
          <blockquote className="border-l-4 border-indigo-500 pl-4 italic font-semibold text-gray-800 dark:text-gray-200">
            Laba Bersih = Pendapatan − Semua Beban
          </blockquote>
          <p>
            Tapi dalam praktiknya, ada beberapa lapisan perhitungan yang penting agar laporan ini akurat dan bisa dipakai untuk mengambil keputusan bisnis.
          </p>

          <h2 id="mengapa-umkm-wajib">Mengapa UMKM Wajib Punya Laporan Laba Rugi?</h2>
          <p>
            Banyak pemilik UMKM di Indonesia masih menganggap pembukuan adalah hal yang ribet dan hanya untuk perusahaan besar. Padahal, laporan laba rugi adalah <strong>tools paling fundamental</strong> untuk pengambilan keputusan bisnis.
          </p>
          <ul>
            <li><strong>Tahu kondisi riil bisnis.</strong> Banyak warung atau toko yang merasa &quot;ramai&quot; tapi ternyata rugi karena tidak tahu margin keuntungan riilnya.</li>
            <li><strong>Syarat pengajuan kredit bank atau KUR.</strong> Bank butuh laporan laba rugi minimal 6-12 bulan terakhir untuk approve pinjaman.</li>
            <li><strong>Menarik investor atau partner bisnis.</strong> Tidak ada investor yang mau masuk ke bisnis tanpa laporan keuangan yang jelas.</li>
            <li><strong>Hitung pajak dengan benar.</strong> PPh Final 0,5% UMKM dihitung dari omzet, tapi PPh Badan dihitung dari laba bersih — harus tahu angkanya.</li>
            <li><strong>Bisa scale up bisnis.</strong> Tanpa data, kamu tidak bisa tahu produk mana yang paling menguntungkan dan harus diperluas.</li>
          </ul>

          <h2 id="komponen-laporan">Komponen Laporan Laba Rugi</h2>
          <p>
            Laporan laba rugi terdiri dari 5 komponen utama. Pahami setiap komponen dengan benar agar laporan kamu akurat:
          </p>
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold">Komponen</th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold">Penjelasan</th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold">Contoh</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3 font-semibold">Pendapatan</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Total uang masuk dari aktivitas utama bisnis</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Penjualan produk, jasa, sewa</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3 font-semibold">HPP (COGS)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Biaya langsung untuk membuat/mendapatkan produk yang dijual</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Bahan baku, kemasan, ongkos kirim supplier</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3 font-semibold">Beban Operasional</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Biaya operasional rutin bisnis (tidak terkait langsung produksi)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Gaji karyawan, sewa tempat, listrik, internet, marketing</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3 font-semibold">Beban Bunga</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Bunga pinjaman bank atau modal kerja</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Bunga KUR, cicilan modal kerja</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3 font-semibold">Pajak</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">Pajak penghasilan badan/UMKM</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">PPh Final 0,5%, PPh Badan 22%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="cara-membuat">Cara Membuat Laporan Laba Rugi (Step by Step)</h2>
          <p>
            Berikut langkah-langkah membuat laporan laba rugi untuk UMKM, mulai dari yang paling sederhana:
          </p>

          <h3>Langkah 1: Tentukan Periode Laporan</h3>
          <p>
            Tentukan dulu periode yang mau dilaporkan: 1 bulan (1-31 Mei), 1 kuartal (Q1: Jan-Mar), atau 1 tahun (Jan-Des). Konsisten dalam memilih periode agar bisa membandingkan performa antar periode.
          </p>

          <h3>Langkah 2: Hitung Total Pendapatan</h3>
          <p>
            Kumpulkan semua transaksi penjualan dalam periode tersebut. Jangan lupa hanya hitung pendapatan dari aktivitas <strong>operasional</strong> bisnis — bukan dari pinjaman atau modal pemilik. Itu masuk ke laporan arus kas, bukan laporan laba rugi.
          </p>

          <h3>Langkah 3: Hitung HPP (Harga Pokok Penjualan)</h3>
          <p>
            HPP = Persediaan Awal + Pembelian − Persediaan Akhir
          </p>
          <p>
            Untuk bisnis jasa, HPP biasanya berisi biaya tenaga kerja langsung yang menghasilkan jasa tersebut. Untuk warung makan, HPP adalah biaya bahan baku yang habis terpakai untuk menu yang terjual.
          </p>

          <h3>Langkah 4: Hitung Laba Kotor</h3>
          <blockquote className="border-l-4 border-indigo-500 pl-4 italic font-semibold text-gray-800 dark:text-gray-200">
            Laba Kotor = Pendapatan − HPP
          </blockquote>
          <p>
            Margin laba kotor (Laba Kotor ÷ Pendapatan × 100%) menunjukkan seberapa efisien bisnis kamu menghasilkan produk. Untuk F&B Indonesia, margin sehat biasanya 60-70%.
          </p>

          <h3>Langkah 5: Kurangi Beban Operasional</h3>
          <p>
            Jumlahkan semua beban operasional: gaji, sewa, listrik, internet, marketing, transportasi, dll. Kurangkan dari laba kotor untuk mendapat <strong>Laba Operasi</strong>.
          </p>

          <h3>Langkah 6: Kurangi Bunga dan Pajak</h3>
          <p>
            Terakhir, kurangkan beban bunga (jika ada pinjaman) dan pajak penghasilan untuk mendapat angka final: <strong>Laba Bersih</strong>.
          </p>

          <h2 id="contoh-laporan">Contoh Laporan Laba Rugi UMKM (Warung Kopi)</h2>
          <p>
            Berikut contoh laporan laba rugi sederhana untuk warung kopi UMKM dengan omzet bulanan Rp 30 juta:
          </p>
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-indigo-50 dark:bg-indigo-900/40">
                  <th colSpan={2} className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-bold">
                    Warung Kopi Senja — Laporan Laba Rugi Mei 2026
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">Pendapatan Penjualan</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">Rp 30.000.000</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">HPP (Bahan baku kopi, susu, gula, kemasan)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 9.000.000)</td>
                </tr>
                <tr className="font-bold bg-emerald-50 dark:bg-emerald-900/30">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Laba Kotor (margin 70%)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">Rp 21.000.000</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">Gaji 2 barista</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 6.000.000)</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">Sewa tempat</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 4.000.000)</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">Listrik & internet</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 1.500.000)</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">Marketing (Instagram ads)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 1.000.000)</td>
                </tr>
                <tr className="font-bold bg-emerald-50 dark:bg-emerald-900/30">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Laba Operasi</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">Rp 8.500.000</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">Bunga pinjaman KUR</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 500.000)</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 pl-8">PPh Final UMKM (0,5% × omzet)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-right">(Rp 150.000)</td>
                </tr>
                <tr className="font-bold bg-indigo-100 dark:bg-indigo-900/50 text-base">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">LABA BERSIH</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-right">Rp 7.850.000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Dari contoh di atas, margin laba bersih warung kopi tersebut adalah <strong>26,2%</strong> (Rp 7.850.000 ÷ Rp 30.000.000). Angka yang sehat untuk industri F&B di Indonesia.
          </p>

          <h2 id="kesalahan-umum">Kesalahan Umum Saat Membuat Laporan Laba Rugi</h2>
          <p>
            Hindari 5 kesalahan ini agar laporan keuangan kamu akurat:
          </p>
          <div className="space-y-4 not-prose my-6">
            {[
              {
                title: 'Mencampur uang pribadi dan bisnis',
                desc: 'Setoran modal pemilik dan prive (penarikan pribadi) BUKAN pendapatan/beban bisnis. Itu masuk ke ekuitas, bukan laporan laba rugi.',
              },
              {
                title: 'Mencatat pembelian aset sebagai beban',
                desc: 'Beli mesin kopi Rp 5 juta bukan beban bulan ini — itu CAPEX yang masuk neraca, lalu disusutkan bertahap (depresiasi) sebagai beban.',
              },
              {
                title: 'Lupa hitung HPP dengan benar',
                desc: 'Banyak UMKM hanya catat pembelian bahan baku sebagai beban langsung. Padahal HPP harus disesuaikan dengan persediaan akhir.',
              },
              {
                title: 'Tidak konsisten periode pencatatan',
                desc: 'Pendapatan Mei tapi beban April masuk ke bulan yang sama — ini melanggar prinsip matching. Harus konsisten cash basis atau accrual basis.',
              },
              {
                title: 'Tidak update setiap hari',
                desc: 'Tunggu sampai akhir bulan baru rekap = pasti banyak transaksi yang lupa. Catat tiap hari, idealnya tiap selesai transaksi.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
              >
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{item.title}</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 m-0">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 id="otomatis-axion">Cara Membuat Laporan Laba Rugi Otomatis dengan AXION</h2>
          <p>
            Membuat laporan laba rugi manual di Excel itu rentan error dan makan waktu. Solusi yang lebih praktis: pakai <strong>software akuntansi double-entry</strong> seperti <Link href="/">AXION</Link>.
          </p>
          <p>
            Cara kerjanya simpel:
          </p>
          <div className="space-y-3 not-prose my-6">
            {[
              'Catat setiap transaksi harian (penjualan, pembelian, beban) dalam 1 klik',
              'AXION otomatis terapkan double-entry bookkeeping ke akun yang sesuai',
              'Laporan laba rugi update real-time — tinggal lihat di dashboard',
              'Bisa export ke PDF/Excel kapan saja untuk laporan ke bank atau investor',
              'Margin kotor, margin operasi, dan margin bersih dihitung otomatis',
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 dark:text-gray-300 m-0">{item}</p>
              </div>
            ))}
          </div>
          <div className="not-prose my-8 p-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white">
            <h3 className="text-xl font-bold mb-2">Coba AXION Gratis</h3>
            <p className="text-indigo-100 mb-4 text-sm leading-relaxed">
              Platform akuntansi double-entry untuk UMKM Indonesia. Laporan laba rugi, neraca, dan arus kas otomatis. Gratis untuk bisnis pertama.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-600 font-semibold text-sm rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Mulai Sekarang
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <h2 id="faq">Pertanyaan yang Sering Diajukan (FAQ)</h2>

          <h3>Apa bedanya laporan laba rugi dan neraca?</h3>
          <p>
            <strong>Laporan laba rugi</strong> menunjukkan kinerja dalam satu periode (untung/rugi). <strong>Neraca</strong> menunjukkan posisi keuangan pada satu titik waktu (aset, hutang, modal). Keduanya saling melengkapi — laba bersih dari laporan laba rugi menambah ekuitas di neraca.
          </p>

          <h3>Apakah saya bisa pakai cash basis atau harus accrual basis?</h3>
          <p>
            Untuk UMKM kecil, <strong>cash basis</strong> (catat saat uang masuk/keluar) lebih simpel dan diperbolehkan. Tapi kalau bisnis kamu sudah kasih kredit ke pelanggan atau punya banyak hutang dagang, <strong>accrual basis</strong> (catat saat transaksi terjadi) lebih akurat.
          </p>

          <h3>Bagaimana kalau bisnis saya rugi?</h3>
          <p>
            Laba bersih negatif berarti bisnis kamu rugi di periode tersebut. Itu normal terjadi terutama di bulan-bulan awal. Yang penting: identifikasi penyebabnya dari laporan — apakah HPP terlalu tinggi (margin kotor rendah), beban operasional terlalu besar, atau pendapatan kurang. Lalu ambil tindakan sesuai data.
          </p>

          <h3>Apakah AXION cocok untuk warung kecil?</h3>
          <p>
            Ya, AXION dibuat khusus untuk UMKM Indonesia — dari warung kopi, toko kelontong, agribisnis, hingga creative agency. Interface-nya sederhana, tapi engine akuntansi double-entry-nya selevel dengan software enterprise.
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/blog"
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Kembali ke Blog
          </Link>
        </div>
      </article>
    </>
  );
}
