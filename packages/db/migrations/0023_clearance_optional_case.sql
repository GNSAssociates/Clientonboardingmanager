-- Make entity_id, case_id, client_id nullable so clearance requests can be
-- auto-created from onboarding links before a full case/client record exists.
-- Add link_token to track which onboarding link created the request.
ALTER TABLE professional_clearance_requests
  ALTER COLUMN entity_id DROP NOT NULL,
  ALTER COLUMN case_id   DROP NOT NULL,
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE professional_clearance_requests
  ADD COLUMN IF NOT EXISTS link_token TEXT;
