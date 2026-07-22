-- M13: retention_jobs table — tracks scheduled hard-purge jobs
-- Soft-delete + 6-year retention policy (ICAEW/HMRC)

CREATE TABLE IF NOT EXISTS "retention_jobs" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"     uuid NOT NULL REFERENCES "entities"("id"),
  "table_name"    text NOT NULL,
  "record_id"     uuid NOT NULL,
  "scheduled_at"  timestamp with time zone NOT NULL,
  "executed_at"   timestamp with time zone,
  "status"        text NOT NULL DEFAULT 'pending',
  "error_message" text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "retention_jobs_entity_idx"    ON "retention_jobs" ("entity_id");
CREATE INDEX IF NOT EXISTS "retention_jobs_scheduled_idx" ON "retention_jobs" ("scheduled_at") WHERE "status" = 'pending';

-- Append-only enforcement: no UPDATE/DELETE on audit_logs (except superuser)
-- This is handled in application code + RLS; document here for review.
-- GRANT INSERT ON "audit_logs" TO authenticated;
-- REVOKE UPDATE, DELETE ON "audit_logs" FROM authenticated;

COMMENT ON TABLE "retention_jobs" IS
  'Scheduled hard-purge jobs for 6+1 year ICAEW/HMRC retention. '
  'Records created at soft-delete time, executed by a scheduled worker.';
