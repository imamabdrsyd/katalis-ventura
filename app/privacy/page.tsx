import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List, Callout } from '@/components/legal/LegalPage';

const pageUrl = 'https://axionventura.com/privacy';
const pageTitle = 'Kebijakan Privasi';
const pageDescription =
  'Kebijakan Privasi AXION (PT Imam Katalis Ventura) — bagaimana kami mengumpulkan, memakai, menyimpan, dan melindungi data Anda, termasuk data Google yang Anda hubungkan.';

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

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      effectiveDate="6 Agustus 2026"
      intro="AXION adalah platform pembukuan double-entry yang dioperasikan oleh PT Imam Katalis Ventura. Dokumen ini menjelaskan data apa yang kami kumpulkan, untuk apa dipakai, dengan siapa dibagikan, dan hak apa yang Anda miliki atas data tersebut."
    >
      <Section heading="1. Data yang kami kumpulkan">
        <p>Kami mengumpulkan tiga jenis data:</p>
        <List
          items={[
            <>
              <strong className="text-gray-800 dark:text-gray-100">Data akun.</strong> Nama, alamat
              email, dan foto profil — diperoleh saat Anda mendaftar, atau dari akun Google Anda bila
              Anda memilih masuk dengan Google.
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Data bisnis yang Anda input.</strong>{' '}
              Catatan transaksi, daftar akun (chart of accounts), data pelanggan/vendor, katalog
              produk, dan lampiran seperti foto struk. Data ini milik Anda; kami hanya memprosesnya
              atas perintah Anda.
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Data teknis.</strong> Log error,
              alamat IP, jenis perangkat dan peramban, serta statistik pemakaian agregat untuk
              menjaga layanan tetap berjalan dan aman.
            </>,
          ]}
        />
        <p>
          Kami <strong className="text-gray-800 dark:text-gray-100">tidak</strong> menjual data Anda,
          dan tidak memakainya untuk iklan.
        </p>
      </Section>

      <Section heading="2. Data Google yang Anda hubungkan">
        <p>
          Bila Anda menghubungkan akun Google ke AXION untuk fitur Google Sheets, kami meminta izin
          seminimal mungkin:
        </p>
        <List
          items={[
            <>
              <code className="text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                openid
              </code>{' '}
              dan{' '}
              <code className="text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                email
              </code>{' '}
              — untuk mengetahui akun Google mana yang terhubung dan menampilkannya di halaman
              pengaturan Anda.
            </>,
            <>
              <code className="text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                drive.file
              </code>{' '}
              — memberi AXION akses <strong className="text-gray-800 dark:text-gray-100">hanya</strong>{' '}
              pada berkas yang Anda pilih sendiri lewat jendela pemilih berkas resmi Google, atau
              berkas yang AXION buatkan untuk Anda saat mengekspor laporan.
            </>,
          ]}
        />
        <Callout>
          AXION <strong>tidak dapat</strong> melihat daftar isi Google Drive Anda, dan{' '}
          <strong>tidak dapat</strong> membuka berkas yang tidak Anda pilih secara eksplisit. Kami
          sengaja tidak meminta izin <code className="text-sm">drive.readonly</code> maupun{' '}
          <code className="text-sm">spreadsheets</code> yang akan memberi akses ke seluruh berkas
          Anda.
        </Callout>
        <p>
          Isi spreadsheet yang Anda tarik hanya diproses di dalam sesi Anda untuk ditampilkan sebagai
          pratinjau. Tidak ada baris yang tersimpan sebagai transaksi sampai Anda meninjau dan
          menyetujuinya. Kami menyimpan pengenal berkas (ID), judul, dan waktu akses terakhir agar
          Anda tidak perlu memilih ulang berkas yang sama; kami tidak menyimpan salinan isi
          spreadsheet Anda.
        </p>
        <Callout>
          Penggunaan dan pengalihan informasi yang AXION terima dari Google API mengikuti{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            Google API Services User Data Policy
          </a>
          , termasuk persyaratan <em>Limited Use</em>. Data Google Anda tidak pernah dipakai untuk
          iklan, tidak dijual, dan tidak dipakai melatih model AI.
        </Callout>
        <p>
          Anda dapat memutus koneksi kapan saja dari halaman Pengaturan di AXION — kami akan mencabut
          token akses ke Google dan menghapus catatan koneksinya. Anda juga bisa mencabutnya langsung
          lewat{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            halaman izin akun Google
          </a>
          .
        </p>
      </Section>

      <Section heading="3. Bagaimana data dipakai">
        <List
          items={[
            'Menjalankan fungsi inti: menyimpan transaksi dan menghasilkan laporan keuangan Anda.',
            'Mengautentikasi Anda dan menjaga keamanan akun.',
            'Menyediakan fitur asisten AI bila Anda mengaktifkannya (lihat bagian 4).',
            'Mengirim pemberitahuan penting terkait layanan dan akun Anda.',
            'Memperbaiki bug dan meningkatkan kualitas produk melalui log error dan statistik agregat.',
          ]}
        />
      </Section>

      <Section heading="4. Fitur AI">
        <p>
          Sebagian fitur AXION memakai model bahasa dari penyedia pihak ketiga (Google Vertex AI,
          Anthropic, dan Groq) — misalnya asisten keuangan dan pembacaan struk otomatis. Bila Anda
          memakai fitur ini, potongan data yang relevan dengan permintaan Anda dikirim ke penyedia
          tersebut untuk diproses.
        </p>
        <p>
          Penyedia tersebut memproses data atas nama kami dan terikat kontrak untuk tidak memakainya
          melatih model mereka. Fitur AI bersifat opsional dan dapat dinonaktifkan.
        </p>
      </Section>

      <Section heading="5. Dengan siapa data dibagikan">
        <p>
          Kami tidak menjual data. Kami membagikannya hanya kepada penyedia layanan yang diperlukan
          agar AXION berjalan:
        </p>
        <List
          items={[
            <>
              <strong className="text-gray-800 dark:text-gray-100">Supabase</strong> — basis data dan
              autentikasi
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Vercel</strong> — hosting aplikasi
              dan statistik pemakaian
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Google Cloud</strong> — infrastruktur
              analitik dan layanan AI
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Cloudinary</strong> — penyimpanan
              gambar dan lampiran
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Anthropic, Groq</strong> — pemrosesan
              model bahasa untuk fitur AI
            </>,
            <>
              <strong className="text-gray-800 dark:text-gray-100">Sentry</strong> — pelacakan error
            </>,
          ]}
        />
        <p>
          Kami juga dapat mengungkapkan data bila diwajibkan hukum yang berlaku, atau untuk
          melindungi hak dan keselamatan pengguna kami.
        </p>
        <p>
          Bila Anda mengundang rekan atau investor ke sebuah bisnis di AXION, mereka dapat melihat
          data keuangan bisnis tersebut sesuai peran yang Anda berikan. Ini adalah pembagian yang
          Anda kendalikan sendiri.
        </p>
      </Section>

      <Section heading="6. Keamanan">
        <List
          items={[
            'Seluruh lalu lintas data dienkripsi dengan TLS.',
            'Token akses pihak ketiga disimpan dalam bentuk terenkripsi (AES-256-GCM), tidak pernah dikirim ke peramban.',
            'Akses antar-pengguna dibatasi di tingkat basis data (row-level security), bukan hanya di antarmuka.',
            'Setiap perubahan pada catatan keuangan direkam dalam jejak audit yang tidak dapat diubah.',
          ]}
        />
        <p>
          Tidak ada sistem yang sepenuhnya kebal. Bila terjadi pelanggaran data yang berisiko bagi
          Anda, kami akan memberi tahu Anda tanpa penundaan yang tidak wajar.
        </p>
      </Section>

      <Section heading="7. Penyimpanan dan penghapusan">
        <p>
          Data Anda kami simpan selama akun Anda aktif. Catatan keuangan yang dihapus disimpan
          sebagai <em>soft delete</em> agar dapat dipulihkan dan demi keutuhan jejak audit.
        </p>
        <p>
          Anda dapat meminta penghapusan akun beserta seluruh datanya dengan menghubungi{' '}
          <a
            href="mailto:support@axionventura.com"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            support@axionventura.com
          </a>
          . Kami memprosesnya dalam 30 hari, kecuali ada kewajiban hukum untuk menyimpan sebagian
          catatan lebih lama.
        </p>
      </Section>

      <Section heading="8. Hak Anda">
        <List
          items={[
            'Mengakses dan mengunduh data Anda (tersedia lewat fitur ekspor PDF/Excel).',
            'Memperbaiki data yang tidak akurat.',
            'Meminta penghapusan akun dan data Anda.',
            'Mencabut izin integrasi pihak ketiga kapan saja.',
            'Menolak pemrosesan untuk fitur opsional seperti AI.',
          ]}
        />
      </Section>

      <Section heading="9. Anak di bawah umur">
        <p>
          AXION ditujukan untuk penggunaan bisnis dan tidak diperuntukkan bagi anak di bawah 18
          tahun. Kami tidak dengan sengaja mengumpulkan data dari anak di bawah umur.
        </p>
      </Section>

      <Section heading="10. Perubahan kebijakan">
        <p>
          Bila ada perubahan material, kami akan memberi tahu lewat email atau pemberitahuan di dalam
          aplikasi sebelum perubahan berlaku. Tanggal berlaku di atas selalu menunjukkan versi
          terkini.
        </p>
      </Section>

      <Section heading="11. Hubungi kami">
        <p>
          Pertanyaan atau permintaan terkait data pribadi Anda dapat dikirim ke{' '}
          <a
            href="mailto:support@axionventura.com"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            support@axionventura.com
          </a>
          . Lihat juga{' '}
          <Link
            href="/terms"
            className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline"
          >
            Syarat &amp; Ketentuan
          </Link>{' '}
          kami.
        </p>
      </Section>
    </LegalPage>
  );
}
