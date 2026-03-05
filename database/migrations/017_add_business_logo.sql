-- Migration: Add logo_url column to businesses table
-- Allows businesses to have a custom logo image

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
