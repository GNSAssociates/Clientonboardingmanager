-- Migration 0028: Custom email templates
-- Lets staff create brand-new templates (not just override the 7 built-in
-- ones) — e.g. an alternate professional clearance letter wording for a
-- specific scenario. is_custom rows have no code default: audience,
-- description and cta_label live on the row itself instead of in code.
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS audience TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS cta_label TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;
