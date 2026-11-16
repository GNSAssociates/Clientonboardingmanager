/**
 * The pure half of lead email history: deciding which way a message went,
 * whether it is a quote, and merging copies of one email found in several
 * mailboxes. No network, no database. Tested by scripts/test-lead-mail.mts.
 */

export interface GraphAddress { emailAddress?: { name?: string; address?: string } }

/** A message as Microsoft Graph returns it, with only the fields we select. */
export interface GraphMessage {
  id: string;
  internetMessageId?: string;
  subject?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  bodyPreview?: string;
  webLink?: string;
  hasAttachments?: boolean;
  isDraft?: boolean;
}

export interface LeadEmail {
  /** Stable across mailboxes: the message's own internet id when it has one. */
  key: string;
  direction: "in" | "out";
  at: string;
  subject: string;
  fromName: string | null;
  fromAddress: string | null;
  to: string[];
  cc: string[];
  preview: string;
  /** Which GNS mailboxes hold a copy, e.g. the sender's Sent Items and info@. */
  mailboxes: string[];
  /** Opens the message in Outlook on the web, for whoever has that mailbox. */
  webLink: string | null;
  attachments: string[];
  hasAttachments: boolean;
  isQuote: boolean;
  source: "mailbox" | "app";
}

const QUOTE_RE = /\b(quot(e|ation)|proposal|fee(s)? (letter|schedule|proposal)|pricing|price list|estimate|engagement letter|letter of engagement)\b/i;

export function addr(a?: GraphAddress): string | null {
  const s = a?.emailAddress?.address?.trim().toLowerCase();
  return s || null;
}

export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** True for addresses on one of our own domains: that is, sent BY GNS. */
export function isOurs(email: string | null, ourDomains: string[]): boolean {
  if (!email) return false;
  const d = domainOf(email);
  return ourDomains.some((o) => d === o || d.endsWith("." + o));
}

export function looksLikeQuote(subject: string, attachments: string[]): boolean {
  return QUOTE_RE.test(subject) || attachments.some((n) => QUOTE_RE.test(n));
}

/**
 * Turn the raw messages from every mailbox into one timeline, newest first.
 *
 * One email sent by a partner with info@ in copy is in two mailboxes; it is
 * shown once, listing both. Drafts are left out: nothing was sent.
 */
export function mergeMailboxResults(
  found: Array<{ mailbox: string; message: GraphMessage; attachments?: string[] }>,
  ourDomains: string[],
): LeadEmail[] {
  const byKey = new Map<string, LeadEmail>();

  for (const { mailbox, message: m, attachments = [] } of found) {
    if (m.isDraft) continue;
    const from = addr(m.from);
    const direction: "in" | "out" = isOurs(from, ourDomains) ? "out" : "in";
    const at = (direction === "out" ? m.sentDateTime : m.receivedDateTime) ?? m.receivedDateTime ?? m.sentDateTime ?? "";
    const key = m.internetMessageId?.trim() || `${from}|${m.subject ?? ""}|${at.slice(0, 16)}`;

    const existing = byKey.get(key);
    if (existing) {
      if (!existing.mailboxes.includes(mailbox)) existing.mailboxes.push(mailbox);
      // Prefer the sender's own copy for the Outlook link: it is the one in Sent Items.
      if (direction === "out" && from === mailbox && m.webLink) existing.webLink = m.webLink;
      for (const a of attachments) if (!existing.attachments.includes(a)) existing.attachments.push(a);
      existing.isQuote = existing.isQuote || looksLikeQuote(existing.subject, existing.attachments);
      continue;
    }

    const subject = (m.subject ?? "").trim() || "(no subject)";
    byKey.set(key, {
      key,
      direction,
      at,
      subject,
      fromName: m.from?.emailAddress?.name?.trim() || null,
      fromAddress: from,
      to: (m.toRecipients ?? []).map(addr).filter((x): x is string => !!x),
      cc: (m.ccRecipients ?? []).map(addr).filter((x): x is string => !!x),
      preview: (m.bodyPreview ?? "").replace(/\s+/g, " ").trim().slice(0, 280),
      mailboxes: [mailbox],
      webLink: m.webLink ?? null,
      attachments: [...attachments],
      hasAttachments: Boolean(m.hasAttachments) || attachments.length > 0,
      isQuote: looksLikeQuote(subject, attachments),
      source: "mailbox",
    });
  }

  return [...byKey.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Emails the platform itself sent (engagement letters, document requests),
 * from the email log. Skipped when the same email was already found in a
 * mailbox's Sent Items, which Graph sends usually leave behind.
 */
export function addAppSent(
  emails: LeadEmail[],
  appSent: Array<{ subject: string; sentAt: string; template: string }>,
  sender: string,
): LeadEmail[] {
  const out = [...emails];
  for (const s of appSent) {
    const minute = s.sentAt.slice(0, 16);
    const dup = emails.some((e) => e.direction === "out" && e.subject === s.subject && e.at.slice(0, 16) === minute);
    if (dup) continue;
    out.push({
      key: `app|${s.sentAt}|${s.subject}`,
      direction: "out",
      at: s.sentAt,
      subject: s.subject,
      fromName: "Sent by the platform",
      fromAddress: sender,
      to: [],
      cc: [],
      preview: `Automatic email (${s.template.replace(/_/g, " ")}).`,
      mailboxes: [],
      webLink: null,
      attachments: [],
      hasAttachments: false,
      isQuote: looksLikeQuote(s.subject, []),
      source: "app",
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Only a plain address is ever put into a mailbox search. */
export function searchableEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) ? e : null;
}
