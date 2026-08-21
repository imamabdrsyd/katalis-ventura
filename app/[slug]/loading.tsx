/**
 * Skeleton halaman publik omnichannel.
 *
 * Kenapa ada: tanpa `loading.tsx`, App Router tidak punya Suspense boundary di
 * sini sehingga TIDAK ADA yang bisa di-stream sebelum seluruh data selesai
 * diambil — browser menahan layar putih polos selama itu. Audience yang klik
 * dari bio Instagram melihat putih beberapa detik lalu halaman muncul sekaligus.
 * Dengan file ini, shell + skeleton terkirim di byte-byte pertama dan konten
 * menyusul saat siap.
 *
 * Bentuknya sengaja meniru kerangka PublicOmniChannelPage (logo bulat di tengah,
 * judul, tagline, satu kartu) supaya peralihannya terasa seperti konten terisi,
 * bukan satu layout ditukar layout lain.
 *
 * Warna sengaja netral abu-abu, bukan warna brand bisnisnya: warna brand baru
 * diketahui SETELAH query DB selesai — persis hal yang sedang ditunggu.
 */

const PULSE = 'animate-pulse motion-reduce:animate-none';

export default function PublicSlugLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col items-center px-4 py-12">
      <div className={`w-full max-w-3xl ${PULSE}`} role="status" aria-busy="true">
        <span className="sr-only">Memuat halaman…</span>

        {/* Identitas: logo bulat + judul + tagline */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 mb-4" />
          <div className="h-7 w-48 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-64 rounded bg-gray-100 dark:bg-gray-800 mt-3" />
        </div>

        {/* Kartu utama — mewakili widget/kartu event yang biasanya di sini */}
        <div className="max-w-md mx-auto w-full space-y-3">
          <div className="h-52 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </main>
  );
}
