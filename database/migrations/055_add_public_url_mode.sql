-- ============================================
-- Migration 055: Add public URL routing mode
-- Allows businesses to choose between route
-- options for omnichannel pages
-- ============================================

-- Add public_url_mode column to business_omni_channels
-- Values: 'slug-only' (/slug), 'axion-only' (/axion/slug), 'both' (/slug and /axion/slug)
ALTER TABLE IF EXISTS business_omni_channels
ADD COLUMN public_url_mode TEXT NOT NULL DEFAULT 'both'
CHECK (public_url_mode IN ('slug-only', 'axion-only', 'both'));

-- Create index for route lookups if needed
CREATE INDEX IF NOT EXISTS idx_omni_channel_url_mode ON business_omni_channels(public_url_mode);
