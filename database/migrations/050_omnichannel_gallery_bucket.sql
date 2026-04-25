-- Migration: (DEPRECATED) gallery upload tetap menggunakan bucket `profiles` yang sudah ada.
-- File gallery disimpan di path `gallery-{businessId}/...` dalam bucket `profiles`.
-- Tidak perlu bucket terpisah — bucket yang dibuat via SQL INSERT mengalami issue
-- di mana file tidak ter-register dengan benar di storage layer.

-- Cleanup: hapus policies yang dibuat di versi sebelumnya (jika sudah di-run)
DROP POLICY IF EXISTS "Business managers can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Business managers can delete gallery images" ON storage.objects;

-- Cleanup: hapus bucket bermasalah (jika sudah dibuat)
-- DELETE FROM storage.buckets WHERE id = 'omnichannel-gallery';
-- ↑ uncomment & jalankan manual setelah memastikan bucket benar-benar tidak terpakai
