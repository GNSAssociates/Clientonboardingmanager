-- M7 RLS for integration tables.

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_connections_entity_isolation ON integration_connections
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

ALTER TABLE ledger_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_snapshots_entity_isolation ON ledger_snapshots
  USING (entity_id = ANY(
    string_to_array(current_setting('app.entity_ids', true), ',')::uuid[]
  ));

REVOKE INSERT, UPDATE, DELETE ON integration_connections FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON ledger_snapshots FROM authenticated, anon;
