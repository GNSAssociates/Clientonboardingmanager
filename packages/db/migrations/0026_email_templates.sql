-- Migration 0026: Editable email templates
-- Stores per-key subject/body overrides for transactional emails. When a row
-- exists for a key, its subject/body are used (with {variable} substitution);
-- otherwise the code default applies. firm_slug '' = applies to all firms.

CREATE TABLE IF NOT EXISTS email_templates (
  key TEXT NOT NULL,
  firm_slug TEXT NOT NULL DEFAULT '',
  name TEXT,
  subject TEXT,
  body TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (key, firm_slug)
);
