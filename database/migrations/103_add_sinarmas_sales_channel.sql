-- Migration 103: Add 'sinarmas' to sales_channel CHECK constraint
-- Sinarmas Sekuritas sebagai sales channel untuk bisnis tipe dagang (trading).

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_sales_channel_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_sales_channel_check
  CHECK (
    sales_channel IS NULL OR sales_channel IN (
      'tiktok', 'tokopedia', 'shopee', 'lazada', 'blibli',
      'airbnb', 'booking_com', 'traveloka',
      'instagram', 'whatsapp', 'sinarmas', 'website',
      'offline', 'other'
    )
  );
