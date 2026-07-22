import { desc, eq } from "drizzle-orm";
import { emailLog } from "../schema/email-log";
import type { Tx } from "../client";

export type EmailLogRow = typeof emailLog.$inferSelect;

export async function insertEmailLog(tx: Tx, row: typeof emailLog.$inferInsert): Promise<void> {
  await tx.insert(emailLog).values(row);
}

export async function listEmailLogByToken(tx: Tx, token: string): Promise<EmailLogRow[]> {
  return tx.select().from(emailLog).where(eq(emailLog.token, token)).orderBy(desc(emailLog.sentAt));
}
