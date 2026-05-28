-- Migration 091: Tutup expose publik bucket transaction-attachments (CRIT-04)
--
-- Masalah:
--   storage.buckets row "transaction-attachments" mempunyai public = TRUE,
--   ditambah policy "Public can view attachments" yang memberi SELECT
--   ke role anon. Akibatnya, file faktur/nota/kuitansi/bukti transfer
--   yang sensitif dapat diakses tanpa otentikasi siapa pun yang tahu
--   atau menemukan URL-nya (URL bisa bocor lewat screenshot, email
--   forward, log analytics; sekali bocor permanen).
--
--   Saat ini bucket berisi 71 file (~27MB) dan 60 record transaksi di
--   tabel transactions masih merujuk URL bucket ini di meta.attachments
--   (artinya bucket masih relevan, walau code modern menggunakan
--   Cloudinary).
--
-- Fix:
--   - Set bucket public = FALSE supaya getPublicUrl tidak lagi melayani
--     konten ke anon.
--   - Drop policy anon SELECT "Public can view attachments".
--   - Policy "Business members can view attachments" (SELECT, authenticated)
--     tetap dipertahankan — member bisnis tetap bisa mengakses lewat
--     supabase storage download / signed URL via klien terautentikasi.
--
-- Catatan klien:
--   Setelah migrasi ini, render `<img src={url}>` untuk URL Supabase
--   Storage tidak lagi bekerja untuk konsumen yang tidak terautentikasi
--   di tab tersebut. Klien akan diarahkan untuk men-generate signed URL
--   via API route ber-auth (lihat patch terpisah). File legacy tetap
--   ter-protect; member bisnis tetap dapat mengaksesnya.

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'transaction-attachments';

DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;

-- ROLLBACK:
--   UPDATE storage.buckets SET public = TRUE WHERE id = 'transaction-attachments';
--   CREATE POLICY "Public can view attachments"
--     ON storage.objects FOR SELECT TO anon
--     USING (bucket_id = 'transaction-attachments');
