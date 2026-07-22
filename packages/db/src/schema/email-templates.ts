import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const emailTemplates = pgTable("email_templates", {
  key: text("key").notNull(),
  firmSlug: text("firm_slug").notNull().default(""),
  name: text("name"),
  subject: text("subject"),
  body: text("body"),
  // Only populated for custom (staff-created) templates — built-in templates
  // get these from code (email-templates-lib.ts) instead.
  audience: text("audience"),
  description: text("description"),
  ctaLabel: text("cta_label"),
  isCustom: boolean("is_custom").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
