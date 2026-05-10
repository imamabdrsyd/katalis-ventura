-- Migration: tambah kolom id_card_attachments di business_contacts
-- Menyimpan metadata file ID card (KTP/SIM/Paspor) yang diupload ke Cloudinary.
-- Struktur tiap item mengikuti TransactionAttachment:
-- { path, url, filename, size, mime_type, uploaded_at }

ALTER TABLE business_contacts
  ADD COLUMN IF NOT EXISTS id_card_attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
