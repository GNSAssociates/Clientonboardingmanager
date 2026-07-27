-- Partner permissions panel: per-role module access.
-- Already applied to the live database. Kept here so a fresh / migrated
-- database (e.g. the UK region move) gets the same table + seed.
-- Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS "module_access" (
  "role_name"      text PRIMARY KEY,
  "can_onboarding" boolean NOT NULL DEFAULT false,
  "can_invoice"    boolean NOT NULL DEFAULT true,
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

-- Seed the current defaults (senior roles = both, junior = invoices only).
-- ON CONFLICT DO NOTHING never overrides a Partner's saved edits.
INSERT INTO "module_access" ("role_name", "can_onboarding", "can_invoice") VALUES
  ('Admin',             true,  true),
  ('Partner',           true,  true),
  ('Manager',           true,  true),
  ('HR',                false, true),
  ('OnboardingStaff',   false, true),
  ('Reviewer',          false, true),
  ('ComplianceOfficer', false, true)
ON CONFLICT ("role_name") DO NOTHING;
