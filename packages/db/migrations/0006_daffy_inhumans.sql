CREATE TYPE "public"."esign_status" AS ENUM('draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired');--> statement-breakpoint
CREATE TYPE "public"."generated_doc_type" AS ENUM('auth_letter', 'engagement_letter', 'clearance_request', 'handover_letter', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "esign_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"generated_doc_id" uuid,
	"provider" text DEFAULT 'dropbox_sign' NOT NULL,
	"provider_ref" text,
	"status" "esign_status" DEFAULT 'draft' NOT NULL,
	"signers" jsonb DEFAULT '[]'::jsonb,
	"sent_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "esign_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"signer_email" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "generated_doc_type" NOT NULL,
	"template_key" text NOT NULL,
	"storage_path" text,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "esign_envelopes" ADD CONSTRAINT "esign_envelopes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "esign_envelopes" ADD CONSTRAINT "esign_envelopes_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "esign_envelopes" ADD CONSTRAINT "esign_envelopes_generated_doc_id_generated_documents_id_fk" FOREIGN KEY ("generated_doc_id") REFERENCES "public"."generated_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "esign_events" ADD CONSTRAINT "esign_events_envelope_id_esign_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."esign_envelopes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_esign_case" ON "esign_envelopes" USING btree ("case_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_esign_provider_ref" ON "esign_envelopes" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_esign_events_envelope" ON "esign_events" USING btree ("envelope_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_case" ON "generated_documents" USING btree ("case_id","type");