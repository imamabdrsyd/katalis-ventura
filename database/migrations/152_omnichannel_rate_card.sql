-- Migration 152: Rate Card di halaman publik omni-channel
--
-- Daftar harga layanan/produk yang tampil di halaman bio `/[slug]`, berdampingan
-- dengan kartu "Book Your Spot" (migr 136). Kasus pertama: Telcantik, yang
-- menjual Paid Promote per Story/Feeds dan selama ini menempelkan rate card-nya
-- sebagai GAMBAR showcase — tidak bisa dibaca screen reader, tidak bisa dicari,
-- dan harus diedit di luar aplikasi tiap kali harganya berubah.
--
-- SUMBER DATANYA `catalog_items`, BUKAN tabel baru.
-- Alasan sama dengan Produk Unggulan (migr 111): harga yang dipajang ke publik
-- wajib harga yang sama dengan yang dipakai picker transaksi EARN. Tabel rate
-- card sendiri akan jadi sumber harga KEDUA yang diam-diam bisa menyimpang —
-- persis kegagalan yang dihindari Asset Console (§28.1) saat menolak ledger
-- paralel. Yang disimpan di sini cuma: item mana, urutannya, dan teks kartunya.
--
-- Konsekuensi yang disengaja: mengubah harga = mengubah item di Katalog, bukan
-- mengetik ulang angka di konfigurasi halaman publik.

ALTER TABLE business_omni_channels
  -- Default false → tidak satu pun halaman publik yang sudah jalan berubah
  -- tampilannya setelah migrasi ini.
  ADD COLUMN IF NOT EXISTS show_rate_card BOOLEAN NOT NULL DEFAULT false,
  -- Urutan array = urutan tampil (pola `featured_item_ids`). Sengaja array, bukan
  -- tabel join: urutannya bagian dari konfigurasi tampilan, bukan relasi yang
  -- perlu di-query sendiri.
  ADD COLUMN IF NOT EXISTS rate_card_item_ids UUID[] NOT NULL DEFAULT '{}',
  -- NULL → kode memakai fallback "Rate Card".
  ADD COLUMN IF NOT EXISTS rate_card_title TEXT,
  -- Catatan kecil di kaki kartu, mis. "Harga belum termasuk pajak".
  ADD COLUMN IF NOT EXISTS rate_card_note TEXT;

COMMENT ON COLUMN business_omni_channels.show_rate_card IS
  'Tampilkan kartu Rate Card di halaman publik. Kartu tetap disembunyikan bila rate_card_item_ids kosong.';
COMMENT ON COLUMN business_omni_channels.rate_card_item_ids IS
  'Urutan catalog_items yang dipajang sebagai Rate Card di halaman publik. Harga & satuan dibaca dari item, bukan disalin ke sini.';
COMMENT ON COLUMN business_omni_channels.rate_card_title IS
  'Judul kartu Rate Card. NULL = fallback "Rate Card" di kode.';
COMMENT ON COLUMN business_omni_channels.rate_card_note IS
  'Catatan kecil di kaki kartu Rate Card (mis. syarat harga).';
