-- Migration 078: Add show_in_logo_slide to businesses
--
-- Memberi kontrol terpisah untuk visibility logo bisnis di carousel/slide
-- logo di landing page Axion.
--
-- Sebelumnya: /api/stats menampilkan semua bisnis non-archived yang punya
-- logo_url tanpa peduli is_public — user tidak bisa opt-out tanpa archive
-- atau hapus logo.
--
-- Sekarang: terpisah dari is_public (yang khusus untuk Storefront widget),
-- memungkinkan kombinasi seperti "tampil di Storefront tapi sembunyikan logo"
-- atau sebaliknya.
--
-- Default: TRUE supaya backward-compatible (semua bisnis lama tetap muncul).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS show_in_logo_slide BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN businesses.show_in_logo_slide IS
  'Apakah logo bisnis tampil di carousel logo di landing page Axion. Default true. Terpisah dari is_public yang khusus mengontrol Storefront widget.';
