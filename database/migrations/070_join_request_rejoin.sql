-- Migration 070: Allow requester to re-submit a join request after being removed.
--
-- Problem: UNIQUE(business_id, requester_id) on business_join_requests blocks a
-- fresh INSERT when an old approved/rejected row exists for the same pair.
-- The upsert in submitJoinRequest resets such rows to 'pending', but it needs
-- an UPDATE policy for the requester.
--
-- Also tightens the INSERT RLS: previously it blocked users who currently have
-- a role in the business, but not those who had a role and were removed.
-- After removal the user_business_roles row is deleted, so the INSERT policy
-- already allows them — no change needed there.

CREATE POLICY "Requester can resubmit own request"
  ON business_join_requests FOR UPDATE
  USING (requester_id = auth.uid())
  WITH CHECK (
    requester_id = auth.uid()
    -- Only allow resetting to pending (not self-approving)
    AND status = 'pending'
  );
