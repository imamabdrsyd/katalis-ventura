/**
 * Skeleton Lobby event.
 *
 * WAJIB ada terpisah dari `app/[slug]/loading.tsx`: tanpa file ini, Next
 * memakai skeleton segment INDUK, sehingga menekan "Pilih tanggal & kunci slot"
 * memunculkan kerangka halaman utama slug (logo bulat besar di tengah) sebelum
 * berganti jadi Lobby — dua layout berbeda berkedip berurutan, persis yang
 * bikin transisinya terasa lambat dan kacau.
 *
 * Bentuknya meniru kerangka EventLobby di layar pilih-tanggal: baris identitas
 * bisnis di kiri atas, judul + subjudul, lalu daftar baris tanggal. Ditambah
 * teks "Memuat lobi…" yang terlihat (bukan cuma sr-only) supaya jeda yang
 * memang ada punya penjelasan, bukan diam tanpa kabar.
 */

const PULSE = 'animate-pulse motion-reduce:animate-none';

export default function EventLobbyLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl mx-auto" role="status" aria-busy="true">
        {/* Identitas bisnis — kiri atas, sejajar dengan Lobby aslinya */}
        <div className={`flex items-center gap-3 mb-6 ${PULSE}`}>
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Eyebrow + judul + baris format */}
        <div className={`mb-5 space-y-2 ${PULSE}`}>
          <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-64 rounded bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* Label langkah + teks status yang benar-benar terbaca */}
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          <span className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-transparent animate-spin motion-reduce:animate-none" />
          Memuat lobi…
        </p>

        {/* Baris tanggal — tinggi & jarak sama dengan baris asli di Lobby */}
        <div className={`space-y-2 ${PULSE}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5"
            >
              <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 mt-1.5" />
              <div className="flex items-center gap-2.5 mt-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700" />
                <div className="h-3 w-12 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
