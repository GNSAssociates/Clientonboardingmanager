import { and, eq } from "drizzle-orm";
import { emailTemplates } from "../schema/email-templates";
import type { Tx } from "../client";

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;

/** Fetch a saved template override for a key (firm-specific first, then global). */
export async function getEmailTemplate(tx: Tx, key: string, firmSlug = ""): Promise<EmailTemplateRow | null> {
  if (firmSlug) {
    const [firmRow] = await tx.select().from(emailTemplates)
      .where(and(eq(emailTemplates.key, key), eq(emailTemplates.firmSlug, firmSlug)));
    if (firmRow) return firmRow;
  }
  const [globalRow] = await tx.select().from(emailTemplates)
    .where(and(eq(emailTemplates.key, key), eq(emailTemplates.firmSlug, "")));
  return globalRow ?? null;
}

export async function listEmailTemplates(tx: Tx): Promise<EmailTemplateRow[]> {
  return tx.select().from(emailTemplates);
}

/** All staff-created custom templates (global, firmSlug=''). */
export async function listCustomEmailTemplates(tx: Tx): Promise<EmailTemplateRow[]> {
  return tx.select().from(emailTemplates)
    .where(and(eq(emailTemplates.firmSlug, ""), eq(emailTemplates.isCustom, true)));
}

export async function upsertEmailTemplate(
  tx: Tx,
  key: string,
  data: {
    name?: string; subject?: string; body?: string; updatedBy?: string; firmSlug?: string;
    audience?: string; description?: string; ctaLabel?: string | null; isCustom?: boolean;
  },
): Promise<EmailTemplateRow> {
  const firmSlug = data.firmSlug ?? "";
  const existing = await tx.select().from(emailTemplates)
    .where(and(eq(emailTemplates.key, key), eq(emailTemplates.firmSlug, firmSlug)));
  if (existing.length) {
    const [row] = await tx.update(emailTemplates)
      .set({
        name: data.name, subject: data.subject, body: data.body, updatedBy: data.updatedBy,
        audience: data.audience, description: data.description, ctaLabel: data.ctaLabel,
        updatedAt: new Date(),
      })
      .where(and(eq(emailTemplates.key, key), eq(emailTemplates.firmSlug, firmSlug)))
      .returning();
    return row!;
  }
  const [row] = await tx.insert(emailTemplates)
    .values({
      key, firmSlug, name: data.name, subject: data.subject, body: data.body, updatedBy: data.updatedBy,
      audience: data.audience, description: data.description, ctaLabel: data.ctaLabel,
      isCustom: data.isCustom ?? false,
    })
    .returning();
  return row!;
}

/** Reset (delete) an override so the code default applies again — or, for a
 * custom template, delete it entirely (there is no code default to fall back to). */
export async function deleteEmailTemplate(tx: Tx, key: string, firmSlug = ""): Promise<void> {
  await tx.delete(emailTemplates)
    .where(and(eq(emailTemplates.key, key), eq(emailTemplates.firmSlug, firmSlug)));
}
