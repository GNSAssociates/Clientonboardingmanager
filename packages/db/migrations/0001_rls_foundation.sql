-- ============================================================================
-- M1 — RLS foundation, session helpers and append-only audit (A3 §6, §7).
--
-- Enforcement model (A2 §10, defence in depth):
--   * Application service layer authorises every use-case (active in dev).
--   * Postgres RLS is the DB-layer backstop. Policies read per-transaction GUCs
--     (app.user_id / app.roles / app.entity_ids / app.client_id / app.is_admin)
--     that the app sets via withSession() (see db/client.ts). In production
--     (Supabase, non-superuser `authenticated` role) these policies are
--     enforced; a local superuser connection bypasses RLS by design.
-- ============================================================================

-- Session helper functions
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_client_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.client_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_entity_ids() RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    string_to_array(NULLIF(current_setting('app.entity_ids', true), ''), ',')::uuid[],
    ARRAY[]::uuid[]
  );
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.is_admin', true) = 'true', false);
$$;

CREATE OR REPLACE FUNCTION has_role(r text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT is_admin()
      OR COALESCE(r = ANY(string_to_array(NULLIF(current_setting('app.roles', true), ''), ',')), false);
$$;
--> statement-breakpoint

-- entities
ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entities_read" ON "entities" FOR SELECT
  USING (is_admin() OR id = ANY(current_entity_ids()));
CREATE POLICY "entities_write" ON "entities" FOR ALL
  USING (has_role('Partner')) WITH CHECK (has_role('Partner'));
--> statement-breakpoint

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read" ON "users" FOR SELECT
  USING (is_admin() OR id = current_user_id() OR entity_id = ANY(current_entity_ids()));
CREATE POLICY "users_write" ON "users" FOR ALL
  USING (has_role('Partner')) WITH CHECK (has_role('Partner'));
--> statement-breakpoint

-- user_roles
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read" ON "user_roles" FOR SELECT
  USING (is_admin() OR user_id = current_user_id() OR entity_id = ANY(current_entity_ids()));
CREATE POLICY "user_roles_write" ON "user_roles" FOR ALL
  USING (has_role('Partner')) WITH CHECK (has_role('Partner'));
--> statement-breakpoint

-- audit_logs (append-only: SELECT + INSERT only, never UPDATE/DELETE)
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON "audit_logs" FOR SELECT
  USING (is_admin() OR has_role('ComplianceOfficer') OR entity_id = ANY(current_entity_ids()));
CREATE POLICY "audit_insert" ON "audit_logs" FOR INSERT
  WITH CHECK (true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE ON "audit_logs" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE UPDATE, DELETE ON "audit_logs" FROM anon;
  END IF;
END $$;
--> statement-breakpoint

-- events (outbox: service-managed)
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_read" ON "events" FOR SELECT
  USING (is_admin() OR entity_id = ANY(current_entity_ids()));
CREATE POLICY "events_write" ON "events" FOR ALL
  USING (has_role('Manager')) WITH CHECK (has_role('Manager'));
