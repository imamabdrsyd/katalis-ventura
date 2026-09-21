/**
 * Isi bawaan Syarat & Ketentuan.
 *
 * Ditranskripsi dari `app/terms/page.tsx` tanpa mengubah satu klausa pun.
 * Penekanan, kata asing bermiring (*double-entry*), dan tautan internal
 * dipindahkan ke markup inline — lihat catatan di `defaults/privacy.ts`.
 *
 * Satu bahasa (Indonesia), sama seperti versi yang selama ini tayang.
 */

import type { LegalContent } from '../types';

export const TERMS_DEFAULTS: LegalContent = {
  title: 'Syarat & Ketentuan',
  effectiveDate: '6 Agustus 2026',
  intro:
    'Dokumen ini mengatur penggunaan AXION, platform pembukuan yang dioperasikan oleh PT Imam Katalis Ventura. Dengan membuat akun atau memakai layanan ini, Anda menyetujui ketentuan di bawah.',

  seo: {
    title: 'Syarat & Ketentuan',
    description:
      'Syarat & Ketentuan penggunaan AXION (PT Imam Katalis Ventura) — layanan, akun, kepemilikan data, batasan tanggung jawab, dan hukum yang berlaku.',
  },

  sections: [
    {
      heading: '1. Layanan',
      blocks: [
        {
          type: 'paragraph',
          text: 'AXION adalah perangkat lunak pembukuan berbasis web dengan sistem pencatatan berpasangan (*double-entry*). Layanan mencakup pencatatan transaksi, penyusunan laporan keuangan, serta fitur pendukung seperti impor/ekspor data dan asisten AI.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'AXION adalah alat bantu pencatatan, **bukan** jasa akuntansi, konsultasi pajak, audit, maupun nasihat keuangan atau investasi. Keluaran AXION tidak menggantikan pertimbangan akuntan, konsultan pajak, atau penasihat profesional Anda.',
        },
      ],
    },

    {
      heading: '2. Akun',
      blocks: [
        {
          type: 'list',
          items: [
            'Anda wajib memberikan informasi yang benar saat mendaftar dan menjaganya tetap mutakhir.',
            'Anda bertanggung jawab atas keamanan kredensial akun dan seluruh aktivitas yang terjadi di dalamnya.',
            'Satu akun ditujukan untuk satu orang. Jangan membagikan kredensial Anda — gunakan fitur undangan anggota bila perlu memberi akses kepada rekan atau investor.',
            'Anda harus berusia minimal 18 tahun dan berwenang mewakili bisnis yang Anda daftarkan.',
          ],
        },
      ],
    },

    {
      heading: '3. Data Anda',
      blocks: [
        {
          type: 'paragraph',
          text: 'Seluruh data bisnis yang Anda masukkan tetap menjadi **milik Anda**. Anda memberi kami izin terbatas untuk menyimpan dan memproses data tersebut semata-mata untuk menjalankan layanan bagi Anda.',
        },
        {
          type: 'paragraph',
          text: 'Anda dapat mengekspor data kapan saja melalui fitur ekspor PDF/Excel, dan meminta penghapusan akun beserta datanya. Perlakuan data selengkapnya dijelaskan di [Kebijakan Privasi](/privacy).',
        },
        {
          type: 'paragraph',
          text: 'Anda bertanggung jawab atas keakuratan data yang Anda masukkan dan atas kepatuhan pencatatan Anda terhadap peraturan perpajakan serta akuntansi yang berlaku di Indonesia.',
        },
      ],
    },

    {
      heading: '4. Penggunaan yang dilarang',
      blocks: [
        { type: 'paragraph', text: 'Anda setuju untuk tidak:' },
        {
          type: 'list',
          items: [
            'Memakai AXION untuk aktivitas melanggar hukum, termasuk pencucian uang atau pemalsuan catatan keuangan.',
            'Mencoba mengakses data pengguna atau bisnis lain tanpa izin.',
            'Merekayasa balik, membongkar, atau mengganggu keamanan dan ketersediaan layanan.',
            'Membebani sistem secara tidak wajar, misalnya lewat permintaan otomatis dalam volume berlebihan.',
            'Mengunggah malware, atau konten yang melanggar hak pihak lain.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Kami berhak menangguhkan atau menghentikan akun yang melanggar ketentuan ini, dengan pemberitahuan bila keadaan memungkinkan.',
        },
      ],
    },

    {
      heading: '5. Integrasi pihak ketiga',
      blocks: [
        {
          type: 'paragraph',
          text: 'AXION dapat terhubung dengan layanan pihak ketiga seperti Google Sheets, WhatsApp, Instagram, atau marketplace, atas permintaan Anda. Koneksi tersebut tunduk pada syarat layanan masing-masing penyedia.',
        },
        {
          type: 'paragraph',
          text: 'Kami tidak bertanggung jawab atas perubahan, gangguan, atau penghentian layanan pihak ketiga yang berada di luar kendali kami. Anda dapat memutus integrasi kapan saja dari halaman pengaturan.',
        },
      ],
    },

    {
      heading: '6. Fitur AI',
      blocks: [
        {
          type: 'paragraph',
          text: 'Fitur berbasis AI bersifat membantu, bukan menentukan. Keluarannya dapat mengandung kekeliruan, termasuk dalam klasifikasi transaksi maupun ringkasan angka.',
        },
        {
          type: 'paragraph',
          text: '**Anda wajib memeriksa setiap hasil AI sebelum menjadikannya catatan resmi.** Kami tidak bertanggung jawab atas keputusan yang diambil semata-mata berdasarkan keluaran AI.',
        },
      ],
    },

    {
      heading: '7. Ketersediaan layanan',
      blocks: [
        {
          type: 'paragraph',
          text: 'Kami berupaya menjaga AXION tetap tersedia, namun tidak menjamin layanan bebas gangguan atau bebas kesalahan. Pemeliharaan terjadwal, perbaikan darurat, atau gangguan pada penyedia infrastruktur kami dapat menyebabkan layanan tidak dapat diakses sementara.',
        },
        {
          type: 'paragraph',
          text: 'Kami dapat menambah, mengubah, atau menghentikan fitur. Untuk perubahan yang material bagi cara Anda memakai layanan, kami akan memberi pemberitahuan sebelumnya.',
        },
      ],
    },

    {
      heading: '8. Biaya',
      blocks: [
        {
          type: 'paragraph',
          text: 'Sebagian fitur tersedia tanpa biaya. Bila di kemudian hari kami memberlakukan biaya berlangganan, ketentuan harga dan tata cara pembayaran akan diumumkan lebih dulu, dan perubahan tidak berlaku surut atas periode yang sudah Anda bayar.',
        },
      ],
    },

    {
      heading: '9. Batasan tanggung jawab',
      blocks: [
        {
          type: 'paragraph',
          text: 'Sepanjang diizinkan hukum yang berlaku, PT Imam Katalis Ventura tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial — termasuk kehilangan keuntungan, kehilangan data, atau kerugian usaha — yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan ini.',
        },
        {
          type: 'paragraph',
          text: 'Layanan disediakan “sebagaimana adanya”. Anda bertanggung jawab menyimpan cadangan data penting Anda sendiri melalui fitur ekspor yang tersedia.',
        },
      ],
    },

    {
      heading: '10. Penghentian',
      blocks: [
        {
          type: 'paragraph',
          text: 'Anda dapat berhenti memakai AXION dan meminta penghapusan akun kapan saja. Kami dapat menghentikan akun yang melanggar ketentuan ini, atau bila layanan dihentikan seluruhnya — dalam hal terakhir kami akan memberi tenggat yang wajar agar Anda dapat mengekspor data.',
        },
      ],
    },

    {
      heading: '11. Hukum yang berlaku',
      blocks: [
        {
          type: 'paragraph',
          text: 'Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa yang timbul akan diselesaikan terlebih dahulu secara musyawarah; bila tidak tercapai, diselesaikan melalui pengadilan yang berwenang di Indonesia.',
        },
      ],
    },

    {
      heading: '12. Perubahan ketentuan',
      blocks: [
        {
          type: 'paragraph',
          text: 'Kami dapat memperbarui Syarat & Ketentuan ini. Untuk perubahan material, pemberitahuan akan dikirim lewat email atau ditampilkan di dalam aplikasi sebelum berlaku. Melanjutkan penggunaan setelah perubahan berlaku berarti Anda menyetujuinya.',
        },
      ],
    },

    {
      heading: '13. Hubungi kami',
      blocks: [
        {
          type: 'paragraph',
          text: 'Pertanyaan mengenai ketentuan ini dapat dikirim ke [support@axionventura.com](mailto:support@axionventura.com).',
        },
      ],
    },
  ],
};
