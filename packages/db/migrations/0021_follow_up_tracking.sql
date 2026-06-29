-- Migration 0021: Add follow-up tracking columns to onboarding_links
-- Tracks prev accountant email, follow-up counts and timestamps for both client and previous accountant

ALTER TABLE onboarding_links
  ADD COLUMN IF NOT EXISTS prev_accountant_email TEXT,
  ADD COLUMN IF NOT EXISTS prev_accountant_firm_name TEXT,
  ADD COLUMN IF NOT EXISTS client_follow_up_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_accountant_follow_up_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_follow_up_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prev_accountant_follow_up_sent_at TIMESTAMPTZ;
