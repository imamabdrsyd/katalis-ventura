-- Add is_primary flag to business_omni_channel_links
-- Allows owner to designate one link as the primary CTA button on product storefronts
ALTER TABLE business_omni_channel_links ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
