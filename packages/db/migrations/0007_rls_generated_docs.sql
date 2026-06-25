-- ============================================================================
-- M4 — RLS policies for generated documents + e-sign tables (A3 §7).
-- Staff (entity-scoped) read/write; clients read their own case's docs.
-- ============================================================================

-- generated_documents
ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gen_docs_read" ON "generated_documents" FOR SELECT
  USING (
    is_admin()
    OR entity_id = ANY(current_entity_ids())
    OR client_id = current_client_id()
  );
CREATE POLICY "gen_docs_write" ON "generated_documents" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- esign_envelopes
ALTER TABLE "esign_envelopes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esign_envelopes_read" ON "esign_envelopes" FOR SELECT
  USING (
    is_admin() OR entity_id = ANY(current_entity_ids()) OR EXISTS (
      SELECT 1 FROM "onboarding_cases" c
      WHERE c.id = case_id AND c.client_id = current_client_id()
    )
  );
CREATE POLICY "esign_envelopes_write" ON "esign_envelopes" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- esign_events (append-only from webhook handler — insert only, read by staff)
ALTER TABLE "esign_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esign_events_read" ON "esign_events" FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM "esign_envelopes" e
      WHERE e.id = envelope_id AND e.entity_id = ANY(current_entity_ids())
    )
  );
CREATE POLICY "esign_events_insert" ON "esign_events" FOR INSERT
  WITH CHECK (true);
