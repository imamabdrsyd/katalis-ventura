/**
 * Isi bawaan Kebijakan Privasi.
 *
 * Ditranskripsi dari `app/privacy/page.tsx` tanpa mengubah satu klausa pun —
 * penekanan `<strong>`, nama OAuth scope sebagai `<code>`, dan tautan keluar ke
 * kebijakan Google dipindahkan ke markup inline (`**`, backtick, `[]()`), bukan
 * dihilangkan. Ini dokumen yang diverifikasi Google saat consent screen OAuth
 * dipublish, jadi kehilangan satu tautan atau satu kalimat bukan cacat kosmetik.
 *
 * Satu bahasa (Indonesia), sama seperti versi yang selama ini tayang.
 * Menerjemahkan dokumen yang mengikat secara hukum butuh penerjemah, bukan field
 * kosong di form admin.
 *
 * Perannya sama seperti default lain: FALLBACK bila belum pernah dipublikasikan,
 * dan titik awal editor di /admin.
 */

import type { LegalContent } from '../types';

export const PRIVACY_DEFAULTS: LegalContent = {
  title: 'Kebijakan Privasi',
  effectiveDate: '6 Agustus 2026',
  intro:
    'AXION adalah platform pembukuan double-entry yang dioperasikan oleh PT Imam Katalis Ventura. Dokumen ini menjelaskan data apa yang kami kumpulkan, untuk apa dipakai, dengan siapa dibagikan, dan hak apa yang Anda miliki atas data tersebut.',

  seo: {
    title: 'Kebijakan Privasi',
    description:
      'Kebijakan Privasi AXION (PT Imam Katalis Ventura) — bagaimana kami mengumpulkan, memakai, menyimpan, dan melindungi data Anda, termasuk data Google yang Anda hubungkan.',
  },

  sections: [
    {
      heading: '1. Data yang kami kumpulkan',
      blocks: [
        { type: 'paragraph', text: 'Kami mengumpulkan tiga jenis data:' },
        {
          type: 'list',
          items: [
            '**Data akun.** Nama, alamat email, dan foto profil — diperoleh saat Anda mendaftar, atau dari akun Google Anda bila Anda memilih masuk dengan Google.',
            '**Data bisnis yang Anda input.** Catatan transaksi, daftar akun (chart of accounts), data pelanggan/vendor, katalog produk, dan lampiran seperti foto struk. Data ini milik Anda; kami hanya memprosesnya atas perintah Anda.',
            '**Data teknis.** Log error, alamat IP, jenis perangkat dan peramban, serta statistik pemakaian agregat untuk menjaga layanan tetap berjalan dan aman.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Kami **tidak** menjual data Anda, dan tidak memakainya untuk iklan.',
        },
      ],
    },

    {
      heading: '2. Data Google yang Anda hubungkan',
      blocks: [
        {
          type: 'paragraph',
          text: 'Bila Anda menghubungkan akun Google ke AXION untuk fitur Google Sheets, kami meminta izin seminimal mungkin:',
        },
        {
          type: 'list',
          items: [
            '`openid` dan `email` — untuk mengetahui akun Google mana yang terhubung dan menampilkannya di halaman pengaturan Anda.',
            '`drive.file` — memberi AXION akses **hanya** pada berkas yang Anda pilih sendiri lewat jendela pemilih berkas resmi Google, atau berkas yang AXION buatkan untuk Anda saat mengekspor laporan.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'AXION **tidak dapat** melihat daftar isi Google Drive Anda, dan **tidak dapat** membuka berkas yang tidak Anda pilih secara eksplisit. Kami sengaja tidak meminta izin `drive.readonly` maupun `spreadsheets` yang akan memberi akses ke seluruh berkas Anda.',
        },
        {
          type: 'paragraph',
          text: 'Isi spreadsheet yang Anda tarik hanya diproses di dalam sesi Anda untuk ditampilkan sebagai pratinjau. Tidak ada baris yang tersimpan sebagai transaksi sampai Anda meninjau dan menyetujuinya. Kami menyimpan pengenal berkas (ID), judul, dan waktu akses terakhir agar Anda tidak perlu memilih ulang berkas yang sama; kami tidak menyimpan salinan isi spreadsheet Anda.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Penggunaan dan pengalihan informasi yang AXION terima dari Google API mengikuti [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), termasuk persyaratan *Limited Use*. Data Google Anda tidak pernah dipakai untuk iklan, tidak dijual, dan tidak dipakai melatih model AI.',
        },
        {
          type: 'paragraph',
          text: 'Anda dapat memutus koneksi kapan saja dari halaman Pengaturan di AXION — kami akan mencabut token akses ke Google dan menghapus catatan koneksinya. Anda juga bisa mencabutnya langsung lewat [halaman izin akun Google](https://myaccount.google.com/permissions).',
        },
      ],
    },

    {
      heading: '3. Bagaimana data dipakai',
      blocks: [
        {
          type: 'list',
          items: [
            'Menjalankan fungsi inti: menyimpan transaksi dan menghasilkan laporan keuangan Anda.',
            'Mengautentikasi Anda dan menjaga keamanan akun.',
            'Menyediakan fitur asisten AI bila Anda mengaktifkannya (lihat bagian 4).',
            'Mengirim pemberitahuan penting terkait layanan dan akun Anda.',
            'Memperbaiki bug dan meningkatkan kualitas produk melalui log error dan statistik agregat.',
          ],
        },
      ],
    },

    {
      heading: '4. Fitur AI',
      blocks: [
        {
          type: 'paragraph',
          text: 'Sebagian fitur AXION memakai model bahasa dari penyedia pihak ketiga (Google Vertex AI, Anthropic, dan Groq) — misalnya asisten keuangan dan pembacaan struk otomatis. Bila Anda memakai fitur ini, potongan data yang relevan dengan permintaan Anda dikirim ke penyedia tersebut untuk diproses.',
        },
        {
          type: 'paragraph',
          text: 'Penyedia tersebut memproses data atas nama kami dan terikat kontrak untuk tidak memakainya melatih model mereka. Fitur AI bersifat opsional dan dapat dinonaktifkan.',
        },
      ],
    },

    {
      heading: '5. Dengan siapa data dibagikan',
      blocks: [
        {
          type: 'paragraph',
          text: 'Kami tidak menjual data. Kami membagikannya hanya kepada penyedia layanan yang diperlukan agar AXION berjalan:',
        },
        {
          type: 'list',
          items: [
            '**Supabase** — basis data dan autentikasi',
            '**Vercel** — hosting aplikasi dan statistik pemakaian',
            '**Google Cloud** — infrastruktur analitik dan layanan AI',
            '**Cloudinary** — penyimpanan gambar dan lampiran',
            '**Anthropic, Groq** — pemrosesan model bahasa untuk fitur AI',
            '**Sentry** — pelacakan error',
          ],
        },
        {
          type: 'paragraph',
          text: 'Kami juga dapat mengungkapkan data bila diwajibkan hukum yang berlaku, atau untuk melindungi hak dan keselamatan pengguna kami.',
        },
        {
          type: 'paragraph',
          text: 'Bila Anda mengundang rekan atau investor ke sebuah bisnis di AXION, mereka dapat melihat data keuangan bisnis tersebut sesuai peran yang Anda berikan. Ini adalah pembagian yang Anda kendalikan sendiri.',
        },
      ],
    },

    {
      heading: '6. Keamanan',
      blocks: [
        {
          type: 'list',
          items: [
            'Seluruh lalu lintas data dienkripsi dengan TLS.',
            'Token akses pihak ketiga disimpan dalam bentuk terenkripsi (AES-256-GCM), tidak pernah dikirim ke peramban.',
            'Akses antar-pengguna dibatasi di tingkat basis data (row-level security), bukan hanya di antarmuka.',
            'Setiap perubahan pada catatan keuangan direkam dalam jejak audit yang tidak dapat diubah.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Tidak ada sistem yang sepenuhnya kebal. Bila terjadi pelanggaran data yang berisiko bagi Anda, kami akan memberi tahu Anda tanpa penundaan yang tidak wajar.',
        },
      ],
    },

    {
      heading: '7. Penyimpanan dan penghapusan',
      blocks: [
        {
          type: 'paragraph',
          text: 'Data Anda kami simpan selama akun Anda aktif. Catatan keuangan yang dihapus disimpan sebagai *soft delete* agar dapat dipulihkan dan demi keutuhan jejak audit.',
        },
        {
          type: 'paragraph',
          text: 'Anda dapat meminta penghapusan akun beserta seluruh datanya dengan menghubungi [support@axionventura.com](mailto:support@axionventura.com). Kami memprosesnya dalam 30 hari, kecuali ada kewajiban hukum untuk menyimpan sebagian catatan lebih lama.',
        },
      ],
    },

    {
      heading: '8. Hak Anda',
      blocks: [
        {
          type: 'list',
          items: [
            'Mengakses dan mengunduh data Anda (tersedia lewat fitur ekspor PDF/Excel).',
            'Memperbaiki data yang tidak akurat.',
            'Meminta penghapusan akun dan data Anda.',
            'Mencabut izin integrasi pihak ketiga kapan saja.',
            'Menolak pemrosesan untuk fitur opsional seperti AI.',
          ],
        },
      ],
    },

    {
      heading: '9. Anak di bawah umur',
      blocks: [
        {
          type: 'paragraph',
          text: 'AXION ditujukan untuk penggunaan bisnis dan tidak diperuntukkan bagi anak di bawah 18 tahun. Kami tidak dengan sengaja mengumpulkan data dari anak di bawah umur.',
        },
      ],
    },

    {
      heading: '10. Perubahan kebijakan',
      blocks: [
        {
          type: 'paragraph',
          text: 'Bila ada perubahan material, kami akan memberi tahu lewat email atau pemberitahuan di dalam aplikasi sebelum perubahan berlaku. Tanggal berlaku di atas selalu menunjukkan versi terkini.',
        },
      ],
    },

    {
      heading: '11. Hubungi kami',
      blocks: [
        {
          type: 'paragraph',
          text: 'Pertanyaan atau permintaan terkait data pribadi Anda dapat dikirim ke [support@axionventura.com](mailto:support@axionventura.com). Lihat juga [Syarat & Ketentuan](/terms) kami.',
        },
      ],
    },
  ],
};
