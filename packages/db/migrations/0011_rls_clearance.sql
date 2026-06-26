-- M6 RLS policies for clearance tables.

ALTER TABLE professional_clearance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY clearance_requests_entity_isolation ON professional_clearance_requests
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

ALTER TABLE clearance_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY clearance_followups_entity_isolation ON clearance_followups
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

REVOKE INSERT, UPDATE, DELETE ON professional_clearance_requests FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON clearance_followups FROM authenticated, anon;
