-- ============================================================================
-- M2 — RLS policies for domain tables (A3 §7). Entity-scoped for staff;
-- own-record for clients. Uses the helper functions from migration 0001.
-- ============================================================================

-- clients
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_read" ON "clients" FOR SELECT
  USING (is_admin() OR entity_id = ANY(current_entity_ids()) OR id = current_client_id());
CREATE POLICY "clients_write" ON "clients" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- client_contacts
ALTER TABLE "client_contacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_contacts_read" ON "client_contacts" FOR SELECT
  USING (is_admin() OR entity_id = ANY(current_entity_ids()) OR client_id = current_client_id());
CREATE POLICY "client_contacts_write" ON "client_contacts" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- onboarding_cases
ALTER TABLE "onboarding_cases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cases_read" ON "onboarding_cases" FOR SELECT
  USING (is_admin() OR entity_id = ANY(current_entity_ids()) OR client_id = current_client_id());
CREATE POLICY "cases_write" ON "onboarding_cases" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- case_transitions (scoped via parent case)
ALTER TABLE "case_transitions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_transitions_read" ON "case_transitions" FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM "onboarding_cases" c
      WHERE c.id = case_id
        AND (c.entity_id = ANY(current_entity_ids()) OR c.client_id = current_client_id())
    )
  );
CREATE POLICY "case_transitions_insert" ON "case_transitions" FOR INSERT
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM "onboarding_cases" c
      WHERE c.id = case_id AND c.entity_id = ANY(current_entity_ids())
    )
  );
--> statement-breakpoint

-- checklist_items
ALTER TABLE "checklist_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_read" ON "checklist_items" FOR SELECT
  USING (
    is_admin() OR entity_id = ANY(current_entity_ids()) OR EXISTS (
      SELECT 1 FROM "onboarding_cases" c WHERE c.id = case_id AND c.client_id = current_client_id()
    )
  );
CREATE POLICY "checklist_write" ON "checklist_items" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- services (global catalogue: read all authenticated, write Partner+)
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_read" ON "services" FOR SELECT USING (true);
CREATE POLICY "services_write" ON "services" FOR ALL
  USING (has_role('Partner')) WITH CHECK (has_role('Partner'));
--> statement-breakpoint

-- client_services
ALTER TABLE "client_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_services_read" ON "client_services" FOR SELECT
  USING (
    is_admin() OR entity_id = ANY(current_entity_ids()) OR EXISTS (
      SELECT 1 FROM "onboarding_cases" c WHERE c.id = case_id AND c.client_id = current_client_id()
    )
  );
CREATE POLICY "client_services_write" ON "client_services" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- pricing_agreements
ALTER TABLE "pricing_agreements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_read" ON "pricing_agreements" FOR SELECT
  USING (
    is_admin() OR entity_id = ANY(current_entity_ids()) OR EXISTS (
      SELECT 1 FROM "onboarding_cases" c WHERE c.id = case_id AND c.client_id = current_client_id()
    )
  );
CREATE POLICY "pricing_write" ON "pricing_agreements" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- task_templates (global config)
ALTER TABLE "task_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_templates_read" ON "task_templates" FOR SELECT USING (true);
CREATE POLICY "task_templates_write" ON "task_templates" FOR ALL
  USING (has_role('Manager')) WITH CHECK (has_role('Manager'));
--> statement-breakpoint

-- tasks
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_read" ON "tasks" FOR SELECT
  USING (is_admin() OR entity_id = ANY(current_entity_ids()) OR assigned_to = current_user_id());
CREATE POLICY "tasks_write" ON "tasks" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
