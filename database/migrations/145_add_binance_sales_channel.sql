-- Migration 145: Add 'binance' to sales_channel CHECK constraint
-- Binance sebagai sales channel untuk bisnis tipe dagang (crypto exchange),
-- mengikuti pola migrasi 103 (Sinarmas Sekuritas).

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_sales_channel_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_sales_channel_check
  CHECK (
    sales_channel IS NULL OR sales_channel IN (
      'tiktok', 'tokopedia', 'shopee', 'lazada', 'blibli',
      'airbnb', 'booking_com', 'traveloka',
      'instagram', 'whatsapp', 'sinarmas', 'binance', 'website',
      'offline', 'other'
    )
  );
