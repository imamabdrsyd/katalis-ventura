/**
 * Sumber tunggal warna kategori transaksi.
 *
 * Keluarga hue-nya: EARN=emerald · OPEX=rose · VAR=pink · CAPEX=blue ·
 * TAX=amber · FIN=indigo · SETTLE=gray. **Jangan menuliskan warna kategori
 * langsung di komponen** — tiap salinan lokal akhirnya drift (pernah terjadi:
 * titik filter memakai red/yellow sementara badge-nya rose/amber, sehingga dua
 * penanda kategori yang sama tampil beda hue di satu layar).
 *
 * LABEL kategori TIDAK ada di sini — itu milik kamus i18n (`t.categories`),
 * karena labelnya ikut bahasa aplikasi sedangkan warnanya tidak.
 */

export const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  EARN: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  OPEX: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  VAR: 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  CAPEX: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
  TAX: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  FIN: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300',
  SETTLE: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  // STOCK sengaja sedikit berbeda dari CAPEX (sama-sama biru) supaya keduanya
  // masih bisa dibedakan saat muncul berdampingan di daftar transaksi.
  STOCK: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
};

/**
 * Titik/strip warna solid — penanda kategori yang terlalu kecil untuk memuat
 * teks (mis. titik di dropdown filter). Keluarga hue-nya WAJIB sama dengan
 * `CATEGORY_BADGE_CLASSES` di atas, hanya shade-nya lebih pekat agar terbaca
 * pada bidang sekecil itu.
 *
 * `STOCK` bukan kategori transaksi sungguhan — itu pseudo-kategori di filter
 * daftar transaksi untuk pembelian stok (VAR yang mendebit akun persediaan),
 * jadi warnanya sengaja turunan pucat dari CAPEX/aset.
 */
export const CATEGORY_DOT_CLASSES: Record<string, string> = {
  EARN: 'bg-emerald-500',
  OPEX: 'bg-rose-500',
  VAR: 'bg-pink-500',
  CAPEX: 'bg-blue-500',
  TAX: 'bg-amber-500',
  FIN: 'bg-indigo-500',
  SETTLE: 'bg-gray-400 dark:bg-gray-500',
  STOCK: 'bg-blue-300 dark:bg-blue-400',
};
