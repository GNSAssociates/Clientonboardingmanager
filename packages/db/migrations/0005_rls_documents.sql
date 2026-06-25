-- ============================================================================
-- M3 — RLS policies for document tables (A3 §7, FR-COL-1..6).
-- Staff (entity-scoped) can read/write docs for their entity.
-- Clients can read their own case's documents.
-- Classifications and versions follow their parent document.
-- ============================================================================

-- documents
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read" ON "documents" FOR SELECT
  USING (
    is_admin()
    OR entity_id = ANY(current_entity_ids())
    OR client_id = current_client_id()
  );
CREATE POLICY "documents_write" ON "documents" FOR ALL
  USING (is_admin() OR entity_id = ANY(current_entity_ids()))
  WITH CHECK (is_admin() OR entity_id = ANY(current_entity_ids()));
--> statement-breakpoint

-- document_versions (scoped via parent document)
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_versions_read" ON "document_versions" FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = document_id
        AND (d.entity_id = ANY(current_entity_ids()) OR d.client_id = current_client_id())
    )
  );
CREATE POLICY "doc_versions_insert" ON "document_versions" FOR INSERT
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = document_id AND d.entity_id = ANY(current_entity_ids())
    )
  );
--> statement-breakpoint

-- document_classifications (staff read/write; clients read own)
ALTER TABLE "document_classifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_classifications_read" ON "document_classifications" FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = document_id
        AND (d.entity_id = ANY(current_entity_ids()) OR d.client_id = current_client_id())
    )
  );
CREATE POLICY "doc_classifications_write" ON "document_classifications" FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = document_id AND d.entity_id = ANY(current_entity_ids())
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = document_id AND d.entity_id = ANY(current_entity_ids())
    )
  );
