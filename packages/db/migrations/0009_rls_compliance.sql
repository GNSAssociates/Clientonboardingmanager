-- M5 RLS policies for compliance tables.
-- All tables are entity-scoped and session-GUC-gated.

-- ── companies_house_records ───────────────────────────────────────────────────
ALTER TABLE companies_house_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY ch_records_entity_isolation ON companies_house_records
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

-- ── kyc_checks ────────────────────────────────────────────────────────────────
ALTER TABLE kyc_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY kyc_checks_entity_isolation ON kyc_checks
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

-- ── cdd_records ───────────────────────────────────────────────────────────────
ALTER TABLE cdd_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdd_records_entity_isolation ON cdd_records
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

-- ── risk_assessments ──────────────────────────────────────────────────────────
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_assessments_entity_isolation ON risk_assessments
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

-- ── sanctions_screenings ──────────────────────────────────────────────────────
ALTER TABLE sanctions_screenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sanctions_screenings_entity_isolation ON sanctions_screenings
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

-- ── compliance_gates ──────────────────────────────────────────────────────────
ALTER TABLE compliance_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_gates_entity_isolation ON compliance_gates
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

-- Block Supabase auth/anon roles from direct mutations (audit integrity)
REVOKE INSERT, UPDATE, DELETE ON companies_house_records FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON kyc_checks FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON cdd_records FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON risk_assessments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON sanctions_screenings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON compliance_gates FROM authenticated, anon;
