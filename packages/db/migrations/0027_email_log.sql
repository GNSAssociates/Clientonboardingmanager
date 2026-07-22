-- Migration 0027: Email send log
-- Records every transactional email attempt (template, recipient, provider,
-- success/error) so staff can see exactly what was sent to a client and when.
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT,
  template_key TEXT NOT NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_token ON email_log (token, sent_at);
