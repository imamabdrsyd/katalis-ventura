-- Migration: Create Supabase Storage bucket for transaction attachments
-- Dokumen sumber: faktur, nota, kuitansi, bukti transfer

-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-attachments',
  'transaction-attachments',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policies for the bucket

-- Allow authenticated users to upload files to their business folder
CREATE POLICY "Business members can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text FROM businesses b
    INNER JOIN user_business_roles ubr ON ubr.business_id = b.id
    WHERE ubr.user_id = auth.uid()
  )
);

-- Allow authenticated users to view files from their businesses
CREATE POLICY "Business members can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text FROM businesses b
    INNER JOIN user_business_roles ubr ON ubr.business_id = b.id
    WHERE ubr.user_id = auth.uid()
  )
);

-- Allow business managers to delete files from their businesses
CREATE POLICY "Business managers can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text FROM businesses b
    INNER JOIN user_business_roles ubr ON ubr.business_id = b.id
    WHERE ubr.user_id = auth.uid()
    AND ubr.role IN ('business_manager', 'both')
  )
);

-- Allow public read access (since bucket is public, for serving images/PDFs)
CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'transaction-attachments');
