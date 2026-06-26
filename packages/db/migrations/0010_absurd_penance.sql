CREATE TYPE "public"."clearance_outcome" AS ENUM('clear', 'issues_raised', 'no_response', 'refused');--> statement-breakpoint
CREATE TYPE "public"."clearance_status" AS ENUM('draft', 'sent', 'chased', 'received', 'declined', 'not_required', 'timed_out');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clearance_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"chase_number" text DEFAULT '1' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_clearance_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"prev_firm_name" text NOT NULL,
	"prev_firm_email" text,
	"prev_firm_address" text,
	"status" "clearance_status" DEFAULT 'draft' NOT NULL,
	"outcome" "clearance_outcome",
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"next_chase_at" timestamp with time zone,
	"response_notes" text,
	"response_data" jsonb,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clearance_followups" ADD CONSTRAINT "clearance_followups_request_id_professional_clearance_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."professional_clearance_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clearance_followups" ADD CONSTRAINT "clearance_followups_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clearance_followups" ADD CONSTRAINT "clearance_followups_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_clearance_requests" ADD CONSTRAINT "professional_clearance_requests_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_clearance_requests" ADD CONSTRAINT "professional_clearance_requests_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_clearance_requests" ADD CONSTRAINT "professional_clearance_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clearance_followups_request_idx" ON "clearance_followups" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clearance_requests_case_idx" ON "professional_clearance_requests" USING btree ("case_id");