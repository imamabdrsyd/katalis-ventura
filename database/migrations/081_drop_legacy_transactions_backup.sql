-- Drop tabel backup snapshot dari migrasi legacy transactions 2026-05-15.
-- Migrasi sukses, 4 baris original sudah ter-konversi ke double-entry/multi-line.
-- Tabel ini muncul di Security Advisor karena di schema public tanpa RLS.

DROP TABLE IF EXISTS public.transactions_pre_legacy_migration_20260515;
