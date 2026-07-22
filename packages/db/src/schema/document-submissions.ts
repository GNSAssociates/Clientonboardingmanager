import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const documentSubmissions = pgTable(
  "document_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingToken: text("onboarding_token").notNull(),
    docType: text("doc_type").notNull(),
    docLabel: text("doc_label").notNull(),
    status: text("status").notNull().default("pending"), // pending | uploaded | rejected
    fileName: text("file_name"),
    fileUrl: text("file_url"),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    // Follow-up tracking
    followUpCount: integer("follow_up_count").notNull().default(0),
    lastFollowUpAt: timestamp("last_follow_up_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: index("doc_sub_token_idx").on(t.onboardingToken),
    typeIdx: index("doc_sub_type_idx").on(t.docType),
    statusIdx: index("doc_sub_status_idx").on(t.status),
  }),
);
