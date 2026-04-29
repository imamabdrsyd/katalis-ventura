-- Migration: business_join_requests
-- Fitur: investor bisa request bergabung ke bisnis public, creator harus approve/reject

-- Tabel join requests
CREATE TABLE IF NOT EXISTS business_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, requester_id)
);

CREATE INDEX idx_join_requests_business ON business_join_requests(business_id, status);
CREATE INDEX idx_join_requests_requester ON business_join_requests(requester_id, status);

CREATE TRIGGER update_business_join_requests_updated_at
  BEFORE UPDATE ON business_join_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE business_join_requests ENABLE ROW LEVEL SECURITY;

-- Requester bisa lihat request miliknya sendiri
CREATE POLICY "Requester can view own requests"
  ON business_join_requests FOR SELECT
  USING (requester_id = auth.uid());

-- Creator bisnis bisa lihat semua request ke bisnisnya
CREATE POLICY "Business creator can view requests"
  ON business_join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_join_requests.business_id
        AND businesses.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
  );

-- User bisa insert request ke bisnis yang belum mereka ikuti
CREATE POLICY "Users can submit join requests"
  ON business_join_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND business_id NOT IN (
      SELECT business_id FROM user_business_roles WHERE user_id = auth.uid()
    )
  );

-- Creator bisnis bisa update (approve/reject) request ke bisnisnya
CREATE POLICY "Business creator can update requests"
  ON business_join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_join_requests.business_id
        AND businesses.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.default_role = 'superadmin'
    )
  );

-- Requester bisa delete (cancel) request miliknya yang masih pending
CREATE POLICY "Requester can cancel pending requests"
  ON business_join_requests FOR DELETE
  USING (requester_id = auth.uid() AND status = 'pending');

-- Kolom is_public di businesses untuk filter daftar bisnis yang bisa di-request
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
