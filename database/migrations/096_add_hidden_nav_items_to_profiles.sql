ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hidden_nav_items jsonb NOT NULL DEFAULT '[]'::jsonb;
