import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token"),
    templateKey: text("template_key").notNull(),
    toEmail: text("to_email").notNull(),
    toName: text("to_name"),
    subject: text("subject").notNull(),
    provider: text("provider").notNull(),
    success: boolean("success").notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byToken: index("idx_email_log_token").on(t.token, t.sentAt),
  }),
);
