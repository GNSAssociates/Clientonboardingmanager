CREATE TABLE IF NOT EXISTS "onboarding_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"client_id" uuid,
	"token" text NOT NULL,
	"company_number" text,
	"company_name" text,
	"client_email" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"resend_count" text DEFAULT '0' NOT NULL,
	"last_resent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_links_entity_idx" ON "onboarding_links" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_links_token_idx" ON "onboarding_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_links_status_idx" ON "onboarding_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_links_email_idx" ON "onboarding_links" USING btree ("client_email");