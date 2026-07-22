CREATE TYPE "public"."finding_severity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_progress', 'findings_raised', 'resolved', 'signed_off');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('bookkeeping', 'vat', 'paye', 'cis', 'accounts', 'trial_balance', 'self_assessment');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"review_task_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"severity" "finding_severity" DEFAULT 'warning' NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"affected_period" text,
	"evidence" jsonb,
	"recommended_action" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"review_type" "review_type" NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"period" text,
	"assigned_to" uuid,
	"snapshot_id" uuid,
	"ai_run_id" uuid,
	"summary" text,
	"completed_at" timestamp with time zone,
	"signed_off_by" uuid,
	"signed_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_review_task_id_review_tasks_id_fk" FOREIGN KEY ("review_task_id") REFERENCES "public"."review_tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_findings_task_idx" ON "review_findings" USING btree ("review_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_findings_severity_idx" ON "review_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_tasks_case_idx" ON "review_tasks" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_tasks_status_idx" ON "review_tasks" USING btree ("status");