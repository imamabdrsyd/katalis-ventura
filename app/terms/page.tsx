import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List, Callout } from '@/components/legal/LegalPage';

const pageUrl = 'https://axionventura.com/terms';
const pageTitle = 'Syarat & Ketentuan';
const pageDescription =
  'Syarat & Ketentuan penggunaan AXION (PT Imam Katalis Ventura) — platform pembukuan double-entry untuk UKM Indonesia.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: pageUrl },
  openGraph: {
    title: `${pageTitle} — AXION`,
    description: pageDescription,
    url: pageUrl,
    type: 'website',
    siteName: 'AXION',
    locale: 'id_ID',
  },
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      effectiveDate="6 Agustus 2026"
      intro="Dokumen ini mengatur penggunaan AXION, platform pembukuan yang dioperasikan oleh PT Imam Katalis Ventura. Dengan membuat akun atau memakai layanan ini, Anda menyetujui ketentuan di bawah."
    >
      <Section heading="1. Layanan">
        <p>
          AXION adalah perangkat lunak pembukuan berbasis web dengan sistem pencatatan berpasangan
          (<em>double-entry</em>). Layanan mencakup pencatatan transaksi, penyusunan laporan keuangan,
          serta fitur pendukung seperti impor/ekspor data dan asisten AI.
        </p>
        <Callout>
          AXION adalah alat bantu pencatatan, <strong>bukan</strong> jasa akuntansi, konsultasi pajak,
          audit, maupun nasihat keuangan atau investasi. Keluaran AXION tidak menggantikan
          pertimbangan akuntan, konsultan pajak, atau penasihat profesional Anda.
        </Callout>
      </Section>

      <Section heading="2. Akun">
        <List
          items={[
            'Anda wajib memberikan informasi yang benar saat mendaftar dan menjaganya tetap mutakhir.',
            'Anda bertanggung jawab atas keamanan kredensial akun dan seluruh aktivitas yang terjadi di dalamnya.',
            'Satu akun ditujukan untuk satu orang. Jangan membagikan kredensial Anda — gunakan fitur undangan anggota bila perlu memberi akses kepada rekan atau investor.',
            'Anda harus berusia minimal 18 tahun dan berwenang mewakili bisnis yang Anda daftarkan.',
          ]}
        />
      </Section>

      <Section heading="3. Data Anda">
        <p>
          Seluruh data bisnis yang Anda masukkan tetap menjadi{' '}
          <strong className="text-gray-800 dark:text-gray-100">milik Anda</strong>. Anda memberi kami
          izin terbatas untuk menyimpan dan memproses data tersebut semata-mata untuk menjalankan
          layanan bagi Anda.
        </p>
        <p>
          Anda dapat mengekspor data kapan saja melalui fitur ekspor PDF/Excel, dan meminta
          penghapusan akun beserta datanya. Perlakuan data selengkapnya dijelaskan di{' '}
          <Link
            href="/privacy"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            Kebijakan Privasi
          </Link>
          .
        </p>
        <p>
          Anda bertanggung jawab atas keakuratan data yang Anda masukkan dan atas kepatuhan pencatatan
          Anda terhadap peraturan perpajakan serta akuntansi yang berlaku di Indonesia.
        </p>
      </Section>

      <Section heading="4. Penggunaan yang dilarang">
        <p>Anda setuju untuk tidak:</p>
        <List
          items={[
            'Memakai AXION untuk aktivitas melanggar hukum, termasuk pencucian uang atau pemalsuan catatan keuangan.',
            'Mencoba mengakses data pengguna atau bisnis lain tanpa izin.',
            'Merekayasa balik, membongkar, atau mengganggu keamanan dan ketersediaan layanan.',
            'Membebani sistem secara tidak wajar, misalnya lewat permintaan otomatis dalam volume berlebihan.',
            'Mengunggah malware, atau konten yang melanggar hak pihak lain.',
          ]}
        />
        <p>
          Kami berhak menangguhkan atau menghentikan akun yang melanggar ketentuan ini, dengan
          pemberitahuan bila keadaan memungkinkan.
        </p>
      </Section>

      <Section heading="5. Integrasi pihak ketiga">
        <p>
          AXION dapat terhubung dengan layanan pihak ketiga seperti Google Sheets, WhatsApp, Instagram,
          atau marketplace, atas permintaan Anda. Koneksi tersebut tunduk pada syarat layanan
          masing-masing penyedia.
        </p>
        <p>
          Kami tidak bertanggung jawab atas perubahan, gangguan, atau penghentian layanan pihak ketiga
          yang berada di luar kendali kami. Anda dapat memutus integrasi kapan saja dari halaman
          pengaturan.
        </p>
      </Section>

      <Section heading="6. Fitur AI">
        <p>
          Fitur berbasis AI bersifat membantu, bukan menentukan. Keluarannya dapat mengandung
          kekeliruan, termasuk dalam klasifikasi transaksi maupun ringkasan angka.
        </p>
        <p>
          <strong className="text-gray-800 dark:text-gray-100">
            Anda wajib memeriksa setiap hasil AI sebelum menjadikannya catatan resmi.
          </strong>{' '}
          Kami tidak bertanggung jawab atas keputusan yang diambil semata-mata berdasarkan keluaran AI.
        </p>
      </Section>

      <Section heading="7. Ketersediaan layanan">
        <p>
          Kami berupaya menjaga AXION tetap tersedia, namun tidak menjamin layanan bebas gangguan atau
          bebas kesalahan. Pemeliharaan terjadwal, perbaikan darurat, atau gangguan pada penyedia
          infrastruktur kami dapat menyebabkan layanan tidak dapat diakses sementara.
        </p>
        <p>
          Kami dapat menambah, mengubah, atau menghentikan fitur. Untuk perubahan yang material bagi
          cara Anda memakai layanan, kami akan memberi pemberitahuan sebelumnya.
        </p>
      </Section>

      <Section heading="8. Biaya">
        <p>
          Sebagian fitur tersedia tanpa biaya. Bila di kemudian hari kami memberlakukan biaya
          berlangganan, ketentuan harga dan tata cara pembayaran akan diumumkan lebih dulu, dan
          perubahan tidak berlaku surut atas periode yang sudah Anda bayar.
        </p>
      </Section>

      <Section heading="9. Batasan tanggung jawab">
        <p>
          Sepanjang diizinkan hukum yang berlaku, PT Imam Katalis Ventura tidak bertanggung jawab atas
          kerugian tidak langsung, insidental, atau konsekuensial — termasuk kehilangan keuntungan,
          kehilangan data, atau kerugian usaha — yang timbul dari penggunaan atau ketidakmampuan
          menggunakan layanan ini.
        </p>
        <p>
          Layanan disediakan &ldquo;sebagaimana adanya&rdquo;. Anda bertanggung jawab menyimpan
          cadangan data penting Anda sendiri melalui fitur ekspor yang tersedia.
        </p>
      </Section>

      <Section heading="10. Penghentian">
        <p>
          Anda dapat berhenti memakai AXION dan meminta penghapusan akun kapan saja. Kami dapat
          menghentikan akun yang melanggar ketentuan ini, atau bila layanan dihentikan seluruhnya —
          dalam hal terakhir kami akan memberi tenggat yang wajar agar Anda dapat mengekspor data.
        </p>
      </Section>

      <Section heading="11. Hukum yang berlaku">
        <p>
          Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa yang timbul akan diselesaikan
          terlebih dahulu secara musyawarah; bila tidak tercapai, diselesaikan melalui pengadilan yang
          berwenang di Indonesia.
        </p>
      </Section>

      <Section heading="12. Perubahan ketentuan">
        <p>
          Kami dapat memperbarui Syarat &amp; Ketentuan ini. Untuk perubahan material, pemberitahuan
          akan dikirim lewat email atau ditampilkan di dalam aplikasi sebelum berlaku. Melanjutkan
          penggunaan setelah perubahan berlaku berarti Anda menyetujuinya.
        </p>
      </Section>

      <Section heading="13. Hubungi kami">
        <p>
          Pertanyaan mengenai ketentuan ini dapat dikirim ke{' '}
          <a
            href="mailto:support@axionventura.com"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            support@axionventura.com
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
