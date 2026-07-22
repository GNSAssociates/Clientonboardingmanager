CREATE TYPE "public"."classification_source" AS ENUM('auto', 'manual', 'agent');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('id_document', 'proof_of_address', 'bank_statement', 'vat_return', 'payroll_record', 'accounts', 'tax_return', 'company_formation', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'received', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid,
	"source" "classification_source" DEFAULT 'agent' NOT NULL,
	"category" "document_category" NOT NULL,
	"confidence" numeric(4, 3),
	"reasoning" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"storage_path" text NOT NULL,
	"hash" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"checklist_item_id" uuid,
	"label" text NOT NULL,
	"category" "document_category" DEFAULT 'other' NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"storage_path" text,
	"hash" text,
	"notes" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_classifications_doc" ON "document_classifications" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_versions_doc" ON "document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_case" ON "documents" USING btree ("case_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_checklist" ON "documents" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_client" ON "documents" USING btree ("client_id");