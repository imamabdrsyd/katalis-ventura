-- Migration: Add transaction_number as human-readable identifier
-- Format: TXN-YYYY-NNNN (sequential per business per year)

-- Add column
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transaction_number TEXT;

-- Function to generate next transaction number for a business+year
CREATE OR REPLACE FUNCTION generate_transaction_number(p_business_id UUID, p_year INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq INT;
  v_number TEXT;
BEGIN
  -- Count existing transactions for this business+year (excluding soft-deleted)
  SELECT COUNT(*) + 1
  INTO v_seq
  FROM transactions
  WHERE business_id = p_business_id
    AND EXTRACT(YEAR FROM date::DATE) = p_year
    AND deleted_at IS NULL
    AND transaction_number IS NOT NULL;

  v_number := 'TXN-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');

  -- Ensure uniqueness within business (handle rare race conditions)
  WHILE EXISTS (
    SELECT 1 FROM transactions
    WHERE business_id = p_business_id
      AND transaction_number = v_number
  ) LOOP
    v_seq := v_seq + 1;
    v_number := 'TXN-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
  END LOOP;

  RETURN v_number;
END;
$$;

-- Trigger function: auto-assign transaction_number on INSERT
CREATE OR REPLACE FUNCTION set_transaction_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.transaction_number IS NULL THEN
    NEW.transaction_number := generate_transaction_number(
      NEW.business_id,
      EXTRACT(YEAR FROM NEW.date::DATE)::INT
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_set_transaction_number ON transactions;
CREATE TRIGGER trg_set_transaction_number
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_number();

-- Backfill existing transactions (ordered by created_at to preserve relative order)
DO $$
DECLARE
  r RECORD;
  v_seq INT;
  v_year INT;
  v_prev_business UUID := NULL;
  v_prev_year INT := NULL;
BEGIN
  FOR r IN
    SELECT id, business_id, date, created_at
    FROM transactions
    WHERE deleted_at IS NULL
      AND transaction_number IS NULL
    ORDER BY business_id, EXTRACT(YEAR FROM date::DATE), created_at
  LOOP
    v_year := EXTRACT(YEAR FROM r.date::DATE)::INT;

    IF v_prev_business IS DISTINCT FROM r.business_id OR v_prev_year IS DISTINCT FROM v_year THEN
      -- Count already-numbered transactions for this business+year
      SELECT COALESCE(COUNT(*), 0) + 1
      INTO v_seq
      FROM transactions
      WHERE business_id = r.business_id
        AND EXTRACT(YEAR FROM date::DATE) = v_year
        AND transaction_number IS NOT NULL;
    END IF;

    UPDATE transactions
    SET transaction_number = 'TXN-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0')
    WHERE id = r.id;

    v_seq := v_seq + 1;
    v_prev_business := r.business_id;
    v_prev_year := v_year;
  END LOOP;
END;
$$;

-- Add unique constraint per business
ALTER TABLE transactions
  ADD CONSTRAINT uq_transaction_number_per_business
  UNIQUE (business_id, transaction_number);
