-- 059: Omnichannel extras
-- Tambah featured_product (JSONB), banner_url ke business_omni_channels
-- Tambah display_mode, custom_icon_url ke business_omni_channel_links

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS featured_product JSONB;

ALTER TABLE business_omni_channel_links
  ADD COLUMN IF NOT EXISTS custom_icon_url TEXT;
