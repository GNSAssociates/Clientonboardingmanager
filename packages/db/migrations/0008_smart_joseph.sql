CREATE TYPE "public"."cdd_outcome" AS ENUM('standard', 'enhanced', 'simplified', 'refused');--> statement-breakpoint
CREATE TYPE "public"."compliance_gate" AS ENUM('pending', 'passed', 'failed', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'in_progress', 'passed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."sanction_status" AS ENUM('clear', 'potential_match', 'confirmed_match', 'false_positive');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cdd_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"outcome" "cdd_outcome" DEFAULT 'standard' NOT NULL,
	"pep_flag" boolean DEFAULT false NOT NULL,
	"sanctions_flag" boolean DEFAULT false NOT NULL,
	"adverse_media_flag" boolean DEFAULT false NOT NULL,
	"source_of_funds" text,
	"source_of_wealth" text,
	"business_activity" text,
	"notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"next_review_due" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies_house_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"company_number" text NOT NULL,
	"company_name" text,
	"company_status" text,
	"company_type" text,
	"incorporated_on" text,
	"registered_address" jsonb,
	"sic_codes" jsonb,
	"officers" jsonb,
	"psc_data" jsonb,
	"filing_history" jsonb,
	"raw_response" jsonb,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"gate_name" text NOT NULL,
	"status" "compliance_gate" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"passed_by" uuid,
	"passed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"provider" text DEFAULT 'amiqus' NOT NULL,
	"provider_ref" text,
	"check_type" text DEFAULT 'standard' NOT NULL,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"initiated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"initiated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"risk_rating" "risk_rating" NOT NULL,
	"overall_score" text,
	"factors" jsonb,
	"reasoning" text,
	"confidence" text,
	"agent_run_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanctions_screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"screening_type" text DEFAULT 'sanctions_pep' NOT NULL,
	"status" "sanction_status" DEFAULT 'clear' NOT NULL,
	"matches" jsonb,
	"notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cdd_records" ADD CONSTRAINT "cdd_records_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cdd_records" ADD CONSTRAINT "cdd_records_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cdd_records" ADD CONSTRAINT "cdd_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies_house_records" ADD CONSTRAINT "companies_house_records_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies_house_records" ADD CONSTRAINT "companies_house_records_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies_house_records" ADD CONSTRAINT "companies_house_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compliance_gates" ADD CONSTRAINT "compliance_gates_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compliance_gates" ADD CONSTRAINT "compliance_gates_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanctions_screenings" ADD CONSTRAINT "sanctions_screenings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanctions_screenings" ADD CONSTRAINT "sanctions_screenings_case_id_onboarding_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."onboarding_cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sanctions_screenings" ADD CONSTRAINT "sanctions_screenings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cdd_records_case_idx" ON "cdd_records" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ch_records_case_idx" ON "companies_house_records" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ch_records_company_number_idx" ON "companies_house_records" USING btree ("company_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_gates_case_idx" ON "compliance_gates" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_gates_gate_name_idx" ON "compliance_gates" USING btree ("case_id","gate_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_checks_case_idx" ON "kyc_checks" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_assessments_case_idx" ON "risk_assessments" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sanctions_screenings_case_idx" ON "sanctions_screenings" USING btree ("case_id");