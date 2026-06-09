-- Migration 097: Add sales_channel field to transactions
-- Tracks the sales channel for EARN transactions (TikTok, Tokopedia, Shopee, etc.)

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sales_channel TEXT DEFAULT NULL;

-- Optional: add a check constraint to limit valid values
ALTER TABLE transactions
  ADD CONSTRAINT transactions_sales_channel_check
  CHECK (
    sales_channel IS NULL OR sales_channel IN (
      'tiktok', 'tokopedia', 'shopee', 'lazada', 'blibli',
      'airbnb', 'booking_com', 'traveloka',
      'instagram', 'whatsapp', 'website',
      'offline', 'other'
    )
  );

COMMENT ON COLUMN transactions.sales_channel IS 'Sales channel for EARN transactions (e.g. tiktok, tokopedia, shopee)';
