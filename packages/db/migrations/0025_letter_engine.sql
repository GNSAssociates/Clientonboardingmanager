-- Migration 0025: Letter engine — per-link letter configuration and archived copies
-- letter_meta: partner, send mode (engagement | details_only), editable scope rows, custom fee lines
-- letter_html: snapshot of the letter as sent to the client
-- signed_html: signed copy with the e-signature audit certificate appended

ALTER TABLE onboarding_links
  ADD COLUMN IF NOT EXISTS letter_meta JSON,
  ADD COLUMN IF NOT EXISTS letter_html TEXT,
  ADD COLUMN IF NOT EXISTS signed_html TEXT;
