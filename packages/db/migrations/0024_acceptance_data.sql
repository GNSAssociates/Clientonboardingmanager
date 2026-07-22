-- Migration 0024: Store engagement acceptance details on the link
-- (typed signature, contact preferences, direct debit mandate details, document statuses)

ALTER TABLE onboarding_links
  ADD COLUMN IF NOT EXISTS acceptance_data JSON;
