-- The practice CRM becomes the master record for who is a client. This is the
-- key that joins the two systems.
--
-- It exists so the first CRM pull can MATCH a client that already exists here
-- and write only this one field. The alternatives are both worse: skipping
-- matched clients leaves two unlinked records and lets a later sync create a
-- duplicate, and updating them would rewrite engagements that have already
-- been signed.
--
-- Nullable deliberately. A client created here before CRM, or one CRM does not
-- know about, has none — and that gap should be reported, not hidden.

ALTER TABLE onboarding_links ADD COLUMN IF NOT EXISTS external_ref text;

-- The sync looks clients up by this on every run.
CREATE INDEX IF NOT EXISTS onboarding_links_external_ref_idx
  ON onboarding_links (external_ref);

-- Company number is how a CRM client is matched to a record here on the first
-- pull, before any external_ref exists.
CREATE INDEX IF NOT EXISTS onboarding_links_company_number_idx
  ON onboarding_links (company_number);

-- Directors and PSCs supplied by CRM match the people already recorded here,
-- rather than being added again under a slightly different spelling.
ALTER TABLE document_people ADD COLUMN IF NOT EXISTS external_ref text;

CREATE INDEX IF NOT EXISTS document_people_external_ref_idx
  ON document_people (external_ref);
