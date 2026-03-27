-- ============================================
-- Migration 014: Omni-Channel "Link-in-Bio" feature
-- Adds public-facing pages for businesses to showcase
-- their social media, e-commerce, and messaging links.
-- ============================================

-- 1. Main omni-channel page config (one per business)
CREATE TABLE IF NOT EXISTS business_omni_channels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  title             TEXT NOT NULL,
  tagline           TEXT,
  bio               TEXT,
  logo_url          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAUL
  T NOW(),
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  updated_by        UUID REFERENCES auth.users(id),
  CONSTRAINT uq_omni_channel_business UNIQUE(business_id),
  CONSTRAINT uq_omni_channel_slug UNIQUE(slug)
);

CREATE INDEX idx_omni_channel_business_id ON business_omni_channels(business_id);
CREATE INDEX idx_omni_channel_slug ON business_omni_channels(slug);

CREATE TRIGGER update_omni_channels_updated_at
  BEFORE UPDATE ON business_omni_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Links for each omni-channel page
CREATE TABLE IF NOT EXISTS business_omni_channel_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  omni_channel_id UUID NOT NULL REFERENCES business_omni_channels(id) ON DELETE CASCADE,
  channel_type    TEXT NOT NULL CHECK (channel_type IN (
                    'instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin',
                    'shopee', 'tokopedia', 'lazada', 'bukalapak', 'blibli',
                    'whatsapp', 'telegram', 'line',
                    'custom'
                  )),
  label           TEXT NOT NULL,
  url             TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_omni_links_omni_channel_id ON business_omni_channel_links(omni_channel_id);

CREATE TRIGGER update_omni_links_updated_at
  BEFORE UPDATE ON business_omni_channel_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS Policies

ALTER TABLE business_omni_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_omni_channel_links ENABLE ROW LEVEL SECURITY;

-- Anyone can view published omni channels (public page)
CREATE POLICY "Anyone can view published omni channels"
  ON business_omni_channels FOR SELECT
  USING (is_published = TRUE);

-- Members can view their own business omni channel (even unpublished, for editing)
CREATE POLICY "Members can view their business omni channel"
  ON business_omni_channels FOR SELECT
  USING (business_id IN (SELECT get_my_business_ids()));

-- Managers can insert omni channel
CREATE POLICY "Managers can insert omni channel"
  ON business_omni_channels FOR INSERT
  WITH CHECK (is_business_manager(business_id));

-- Managers can update omni channel
CREATE POLICY "Managers can update omni channel"
  ON business_omni_channels FOR UPDATE
  USING (is_business_manager(business_id));

-- Managers can delete omni channel
CREATE POLICY "Managers can delete omni channel"
  ON business_omni_channels FOR DELETE
  USING (is_business_manager(business_id));

-- Anyone can view links of published channels
CREATE POLICY "Anyone can view links of published channels"
  ON business_omni_channel_links FOR SELECT
  USING (
    omni_channel_id IN (
      SELECT id FROM business_omni_channels WHERE is_published = TRUE
    )
  );

-- Members can view links of their business channels (for editing)
CREATE POLICY "Members can view their business channel links"
  ON business_omni_channel_links FOR SELECT
  USING (
    omni_channel_id IN (
      SELECT id FROM business_omni_channels
      WHERE business_id IN (SELECT get_my_business_ids())
    )
  );

-- Managers can insert links
CREATE POLICY "Managers can insert omni channel links"
  ON business_omni_channel_links FOR INSERT
  WITH CHECK (
    omni_channel_id IN (
      SELECT id FROM business_omni_channels
      WHERE is_business_manager(business_id)
    )
  );

-- Managers can update links
CREATE POLICY "Managers can update omni channel links"
  ON business_omni_channel_links FOR UPDATE
  USING (
    omni_channel_id IN (
      SELECT id FROM business_omni_channels
      WHERE is_business_manager(business_id)
    )
  );

-- Managers can delete links
CREATE POLICY "Managers can delete omni channel links"
  ON business_omni_channel_links FOR DELETE
  USING (
    omni_channel_id IN (
      SELECT id FROM business_omni_channels
      WHERE is_business_manager(business_id)
    )
  );

-- 4. Helper function to check slug availability
CREATE OR REPLACE FUNCTION is_slug_available(p_slug TEXT, p_exclude_business_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM business_omni_channels
    WHERE slug = p_slug
      AND (p_exclude_business_id IS NULL OR business_id != p_exclude_business_id)
  );
$$;
