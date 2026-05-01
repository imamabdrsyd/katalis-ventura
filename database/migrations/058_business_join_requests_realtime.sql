-- Migration: enable Supabase Realtime untuk business_join_requests
-- Tujuan: notifikasi creator real-time saat ada request baru,
-- dan notifikasi requester saat statusnya berubah (approved/rejected).

-- Tambahkan tabel ke publication supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'business_join_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE business_join_requests';
  END IF;
END $$;

-- Pastikan REPLICA IDENTITY FULL agar event UPDATE membawa old row (untuk RLS check)
ALTER TABLE business_join_requests REPLICA IDENTITY FULL;
