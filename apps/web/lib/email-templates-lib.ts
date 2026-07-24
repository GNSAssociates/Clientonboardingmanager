/**
 * Editable email templates.
 *
 * Each transactional email has a default subject + body here. Staff can override
 * the subject/body per key from /staff/templates; overrides are stored in the
 * `email_templates` table. Bodies are HTML with {variable} placeholders that are
 * substituted at send time, then wrapped in the firm's branded shell.
 */
import type { FirmConfig } from './firms';

export interface TemplateDef {
  key: string;
  name: string;
  audience: 'Client' | 'Previous Accountant' | 'Firm';
  description: string;
  ctaLabel?: string;       // if set, a button linking to {actionUrl} is added
  defaultSubject: string;
  defaultBody: string;     // HTML with {variables}
}

export const TEMPLATE_VARIABLES: Array<[string, string]> = [
  ['{directorName}', 'The client director / signatory'],
  ['{companyName}', 'Client company name'],
  ['{companyNumber}', 'Companies House number'],
  ['{firmName}', 'Short firm name (e.g. GNS Associates)'],
  ['{firmLegalName}', 'Full legal firm name'],
  ['{firmEmail}', 'Firm email'],
  ['{firmPhone}', 'Firm phone'],
  ['{prevFirmName}', 'Previous accountant firm name'],
  ['{expiresAt}', 'Link expiry date'],
  ['{today}', "Today's date"],
  ['{followUpNumber}', 'Reminder/chase number'],
  ['{signedContractUrl}', 'Link to the signed contract PDF (welcome email)'],
  ['{outstandingList}', 'Bulleted list of outstanding clearance documents (chase email)'],
  ['{receivedNote}', 'Note listing already-received clearance documents (chase email)'],
  ['{actionUrl}', 'The secure link the button points to'],
];

export const EMAIL_TEMPLATES: TemplateDef[] = [
  {
    key: 'client_engagement',
    name: 'Engagement letter — to client',
    audience: 'Client',
    description: 'Sent to the client when an engagement letter is issued.',
    ctaLabel: 'Review & Sign Engagement Letter',
    defaultSubject: 'Engagement Letter — {companyName} & {firmLegalName}',
    defaultBody:
      `<p>Dear {directorName},</p>
       <p>We are pleased to confirm that {firmLegalName} would like to act as accountants for {companyName} (Company No. {companyNumber}). Please review your engagement letter, provide your previous accountant details, and sign the declaration.</p>
       <p><strong>This link expires on {expiresAt}.</strong> If you have any questions before signing, please contact us at {firmEmail} or call {firmPhone}.</p>`,
  },
  {
    key: 'client_proposal',
    name: 'Proposal — to client',
    audience: 'Client',
    description: 'Sent when a proposal (with or without engagement) is issued.',
    ctaLabel: 'Review & Approve Proposal',
    defaultSubject: 'Proposal for {companyName} — {firmLegalName}',
    defaultBody:
      `<p>Dear {directorName},</p>
       <p>We are grateful for your interest in our services and are pleased to present our proposal for {companyName} (Company No. {companyNumber}). Please review the proposal below and, if you are happy to proceed, approve it — we will then send your engagement letter to formalise the appointment.</p>
       <p><strong>This link expires on {expiresAt}.</strong></p>`,
  },
  {
    key: 'client_details_request',
    name: 'Previous accountant details request — to client',
    audience: 'Client',
    description: "Sent when you only need the client's previous accountant details.",
    ctaLabel: 'Provide Previous Accountant Details',
    defaultSubject: "Action required: your previous accountant's details — {companyName}",
    defaultBody:
      `<p>Dear {directorName},</p>
       <p>As part of taking over the accounting affairs of {companyName}, we need to contact your previous accountant to request professional clearance and the handover of your records. Please use the secure link below to provide their details — it takes less than a minute.</p>
       <p><strong>This link is valid until {expiresAt}.</strong></p>`,
  },
  {
    key: 'client_welcome',
    name: 'Welcome (signed) — to client',
    audience: 'Client',
    description: 'Confirmation sent to the client after they sign.',
    ctaLabel: 'Upload Your Documents',
    defaultSubject: 'Engagement Signed — Welcome to {firmLegalName}',
    defaultBody:
      `<p>Dear {directorName},</p>
       <p>Thank you for signing your engagement letter — welcome to {firmLegalName}. A copy of your signed contract is stored securely on your file and available to download here: <a href="{signedContractUrl}">View / download your signed contract (with signature certificate)</a>.</p>
       <p>To complete your onboarding, please upload your identity documents using the button below. A member of our team will be in touch within 2 business days.</p>`,
  },
  {
    key: 'prev_clearance_request',
    name: 'Professional clearance request — to previous accountant',
    audience: 'Previous Accountant',
    description: 'The initial clearance letter emailed to the previous accountant.',
    ctaLabel: 'Respond to Clearance Request',
    defaultSubject: 'Professional Clearance Request — {companyName} ({companyNumber})',
    defaultBody:
      `<p>Dear Sirs,</p>
       <p>We have been requested to act as accountants for {companyName} (Company No. {companyNumber}) and its director {directorName}, and are writing to enquire whether there are any professional reasons why we should not act.</p>
       <p>Please find <strong>attached a letter</strong> setting out the information and records we require to ensure a smooth changeover. We should be grateful if you would simply reply to this email with the requested items at your convenience — there is no portal to log in to.</p>
       <p>Thank you for your assistance in this matter.</p>`,
  },
  {
    key: 'prev_clearance_chase',
    name: 'Clearance follow-up — to previous accountant',
    audience: 'Previous Accountant',
    description: 'Auto follow-up chasing outstanding clearance documents.',
    ctaLabel: 'Respond to Clearance Request',
    defaultSubject: '[Chase {followUpNumber}] Professional Clearance — {companyName}',
    defaultBody:
      `<p>Dear {prevFirmName},</p>
       <p>We refer to our earlier professional clearance request for {companyName} and note that the following items remain outstanding. We would be grateful if you could arrange to send them at your earliest convenience.</p>
       {outstandingList}
       {receivedNote}`,
  },
  {
    key: 'client_doc_reminder',
    name: 'ID document reminder — to client',
    audience: 'Client',
    description: 'Auto reminder chasing the client for ID documents (every 2 days).',
    ctaLabel: 'Upload Documents Now',
    defaultSubject: 'Reminder {followUpNumber}: ID documents needed — {companyName}',
    defaultBody:
      `<p>Dear {directorName},</p>
       <p>Thank you for signing your engagement letter for {companyName}. To complete your anti-money-laundering (KYC) checks, we still need the following identity document(s) from you:</p>
       {outstandingList}
       <p>Uploading takes less than 2 minutes — a photo taken on your phone is fine.</p>`,
  },
  {
    key: 'client_otp',
    name: 'Verification code — to client',
    audience: 'Client',
    description: 'One-time code sent to the client before they can open the engagement letter.',
    ctaLabel: undefined,
    defaultSubject: 'Your verification code — {companyName}',
    defaultBody:
      `<p>Dear Director,</p>
       <p>Your verification code to access the engagement letter for <strong>{companyName}</strong> is:</p>
       <p style="text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f3f4f6;border-radius:8px;font-family:monospace">{code}</p>
       <p>This code expires in 10 minutes. If you did not request this, please ignore this email.</p>`,
  },
];

export function templateDef(key: string): TemplateDef | undefined {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}

/** Substitute {variable} placeholders. Unknown placeholders are left as-is. */
export function renderVars(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? m : String(v);
  });
}

/** Wrap a rendered body in the firm's branded email shell. */
export function brandedEmailShell(firm: FirmConfig, bodyHtml: string, opts?: { ctaLabel?: string; actionUrl?: string; today?: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const logo = appUrl && !appUrl.startsWith('http://localhost')
    ? `<img src="${appUrl}${firm.logo}" alt="${firm.name}" height="46" style="display:block;margin-bottom:14px">` : '';
  const button = opts?.ctaLabel && opts?.actionUrl
    ? `<div style="text-align:center;margin:26px 0"><a href="${opts.actionUrl}" style="display:inline-block;background:${firm.accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">${opts.ctaLabel}</a></div>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${firm.accentColor},#1e3a8a);font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:30px 36px;font-size:14px;line-height:1.7;color:#374151">
    ${logo}
    <p style="margin:0 0 18px;font-size:16px;font-weight:700;color:#111">${firm.legalName}</p>
    ${bodyHtml}
    ${button}
    <p style="margin:22px 0 0;font-size:14px;color:#374151">Kind regards,<br><strong>${firm.name}</strong><br><span style="color:#6b7280;font-size:13px">${firm.phone} · ${firm.email}</span></p>
  </td></tr>
  <tr><td style="padding:16px 36px 24px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#9ca3af">${firm.regStatement}</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export interface RenderedEmail { subject: string; html: string }

/**
 * Resolve a template (override subject/body if provided, else default), render
 * variables, and wrap in the branded shell. `override` comes from the DB.
 *
 * `customFallback` supplies the "code default" for a staff-created custom
 * template (one with no entry in EMAIL_TEMPLATES) — its own DB row IS the
 * definition, so callers pass its ctaLabel/subject/body here when `key`
 * isn't a built-in.
 */
export function renderEmailTemplate(
  key: string,
  firm: FirmConfig,
  vars: Record<string, string | number | null | undefined>,
  override?: { subject?: string | null; body?: string | null } | null,
  actionUrl?: string,
  customFallback?: { ctaLabel?: string | null; defaultSubject: string; defaultBody: string },
): RenderedEmail | null {
  const builtIn = templateDef(key);
  const def = builtIn ?? (customFallback ? {
    key, name: key, audience: 'Client' as const, description: '',
    ctaLabel: customFallback.ctaLabel ?? undefined,
    defaultSubject: customFallback.defaultSubject, defaultBody: customFallback.defaultBody,
  } : undefined);
  if (!def) return null;
  const subjectTpl = override?.subject || def.defaultSubject;
  const bodyTpl = override?.body || def.defaultBody;
  const subject = renderVars(subjectTpl, vars);
  const body = renderVars(bodyTpl, vars);
  const html = brandedEmailShell(firm, body, { ctaLabel: def.ctaLabel, actionUrl });
  return { subject, html };
}
