-- Auth system tables for email/password login, 2FA, and sessions
-- Also adds 'local' to auth_provider enum and 'HR' to role_name enum

-- Add 'local' to auth_provider enum
ALTER TYPE "auth_provider" ADD VALUE IF NOT EXISTS 'local';

-- Add 'HR' to role_name enum
ALTER TYPE "role_name" ADD VALUE IF NOT EXISTS 'HR';

-- User credentials (password hashes, reset tokens)
CREATE TABLE IF NOT EXISTS "user_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id"),
  "password_hash" text NOT NULL,
  "reset_token" text,
  "reset_token_expires_at" timestamptz,
  "two_factor_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Auth sessions (server-side session tracking)
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "remember_me" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_auth_sessions_user" ON "auth_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_expiry" ON "auth_sessions"("expires_at");

-- Two-factor authentication codes
CREATE TABLE IF NOT EXISTS "two_factor_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "code" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "used" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_2fa_codes_user" ON "two_factor_codes"("user_id");
