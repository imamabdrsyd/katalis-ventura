ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS button_color TEXT;

ALTER TABLE business_omni_channels
  ADD COLUMN IF NOT EXISTS banner_position TEXT NOT NULL DEFAULT 'center';

ALTER TABLE business_omni_channel_links
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'default'
    CHECK (display_mode IN ('default', 'icon_only'));
