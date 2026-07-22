import { getDb, getEmailTemplate, insertEmailLog } from "@gns/db";
import { renderEmailTemplate, templateDef } from "@/lib/email-templates-lib";
import { getFirm, type FirmConfig } from "@/lib/firms";
import { sendMailResult, type MailResult } from "@/lib/mailer";

/**
 * Send one of the editable transactional emails.
 *
 * Resolves the staff-saved override (subject/body) for `key` from the
 * `email_templates` table, renders the {variables}, wraps it in the firm's
 * branded shell, and sends it (SMTP → Resend fallback, with the firm-wide CC).
 *
 * Falls back to the code default in email-templates-lib when no override exists,
 * so this is always safe to call even before staff have edited anything.
 */
export async function sendTemplatedMail(args: {
  key: string;
  firm: FirmConfig | string;
  to: string;
  toName?: string;
  vars: Record<string, string | number | null | undefined>;
  actionUrl?: string;
  cc?: string;
  noGlobalCc?: boolean;
  replyTo?: string;
  /** Onboarding link token — when given, the send is recorded in the email log
   * so staff can see exactly what was sent to this client and when. */
  token?: string;
}): Promise<MailResult> {
  const firm = typeof args.firm === "string" ? getFirm(args.firm) : args.firm;

  // Load the override (firm-specific first, then global). Never let a DB hiccup
  // block a send — fall through to the code default.
  let override: { subject?: string | null; body?: string | null; ctaLabel?: string | null } | null = null;
  try {
    const db = getDb();
    override = await db.transaction((tx) => getEmailTemplate(tx, args.key, firm.slug));
  } catch (e) {
    console.error(`sendTemplatedMail: could not load override for ${args.key}:`, e);
  }

  // Ensure the common firm variables are always available to the template.
  const vars: Record<string, string | number | null | undefined> = {
    firmName: firm.name,
    firmLegalName: firm.legalName,
    firmEmail: firm.email,
    firmPhone: firm.phone,
    today: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    ...args.vars,
  };

  // A custom (staff-created) template has no code default — its own DB row
  // provides the fallback subject/body/ctaLabel that renderEmailTemplate needs.
  const customFallback = !templateDef(args.key) && override
    ? { ctaLabel: override.ctaLabel, defaultSubject: override.subject ?? "", defaultBody: override.body ?? "" }
    : undefined;

  const rendered = renderEmailTemplate(args.key, firm, vars, override, args.actionUrl, customFallback);
  if (!rendered) {
    console.error(`sendTemplatedMail: unknown template key "${args.key}"`);
    return { ok: false, provider: "none", error: `Unknown template: ${args.key}` };
  }

  const result = await sendMailResult({
    to: args.to,
    toName: args.toName,
    subject: rendered.subject,
    html: rendered.html,
    cc: args.cc,
    noGlobalCc: args.noGlobalCc,
    replyTo: args.replyTo,
  });

  // Record what was actually sent, so staff can see the client's email history.
  // Never let logging failure affect the send outcome.
  try {
    const db = getDb();
    await db.transaction((tx) =>
      insertEmailLog(tx, {
        token: args.token ?? null,
        templateKey: args.key,
        toEmail: args.to,
        toName: args.toName ?? null,
        subject: rendered.subject,
        provider: result.provider,
        success: result.ok,
        error: result.error ?? null,
      })
    );
  } catch (e) {
    console.error("sendTemplatedMail: email log insert failed (non-fatal):", e);
  }

  return result;
}
