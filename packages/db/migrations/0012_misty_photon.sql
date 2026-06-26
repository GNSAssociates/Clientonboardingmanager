CREATE TYPE "public"."integration_provider" AS ENUM('xero', 'qbo');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('pending', 'connected', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."ledger_snapshot_kind" AS ENUM('trial_balance', 'ledgers', 'vat', 'payroll', 'coa');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"tenant_id" text,
	"tenant_name" text,
	"scopes" text,
	"connected_by" uuid,
	"disconnected_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"case_id" uuid,
	"connection_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"kind" "ledger_snapshot_kind" NOT NULL,
	"period" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pulled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_client_provider_idx" ON "integration_connections" USING btree ("client_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_entity_idx" ON "integration_connections" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_snapshot_client_kind_idx" ON "ledger_snapshots" USING btree ("client_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_snapshot_case_idx" ON "ledger_snapshots" USING btree ("case_id");