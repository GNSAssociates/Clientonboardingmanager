-- Migration 0022: Document submissions table for client document collection portal

CREATE TABLE IF NOT EXISTS document_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_token TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_name TEXT,
  file_url TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  last_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doc_sub_token_idx ON document_submissions(onboarding_token);
CREATE INDEX IF NOT EXISTS doc_sub_type_idx ON document_submissions(doc_type);
CREATE INDEX IF NOT EXISTS doc_sub_status_idx ON document_submissions(status);
