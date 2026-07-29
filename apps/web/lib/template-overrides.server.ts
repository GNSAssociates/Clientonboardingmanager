/**
 * Server-only DB access for staff-editable template overrides (/staff/templates).
 *
 * Deliberately kept OUT of email-templates-lib.ts and letter-html.ts: both of
 * those are imported by client components (the onboarding wizard uses their
 * pure constants/types), and importing @gns/db (the postgres driver) from a
 * module reachable by the client bundle breaks the Next.js build ("Can't
 * resolve 'net'/'tls'/'fs'"). This file must only be imported from server
 * code (API routes, clearance-pdf.ts) — never from letter-html.ts directly.
 */
import { getDb, getEmailTemplate } from "@gns/db";

/** Load a staff-saved override for any template key, firm-specific first then
 * global. Never throws — a DB hiccup falls back to the code default so a
 * letter/PDF can never fail to generate because of this. */
export async function loadTemplateOverride(
  key: string,
  firmSlug = "",
): Promise<{ subject?: string | null; body?: string | null } | null> {
  try {
    const db = getDb();
    return await db.transaction((tx) => getEmailTemplate(tx, key, firmSlug));
  } catch (e) {
    console.error(`loadTemplateOverride: could not load override for ${key}:`, e);
    return null;
  }
}

/** The engagement letter's two editable text blocks, resolved in one call so
 * every buildLetterHtml() call site fetches them the same way. */
export async function loadEngagementLetterOverrides(
  firmSlug = "",
): Promise<{ introOverrideHtml: string | null; closingOverrideHtml: string | null }> {
  const [intro, closing] = await Promise.all([
    loadTemplateOverride("doc_engagement_intro", firmSlug),
    loadTemplateOverride("doc_engagement_closing", firmSlug),
  ]);
  return { introOverrideHtml: intro?.body ?? null, closingOverrideHtml: closing?.body ?? null };
}
