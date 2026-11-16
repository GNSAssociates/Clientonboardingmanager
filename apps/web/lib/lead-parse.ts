/**
 * Turning a website enquiry into one tidy lead.
 *
 * Enquiries reach us in more than one shape. The WordPress bridge
 * (docs/wordpress/gns-leads-bridge.php) sends WPForms' own field list: each
 * field with its label, its type and the value typed. The WPForms Webhooks
 * add-on, Zapier and a hand-built test all send a flat object instead. Both
 * are accepted, because the form on the website will be edited by whoever
 * looks after the site, and a lead must not vanish because someone renamed
 * "Phone" to "Mobile number".
 *
 * So fields are recognised by their TYPE first (WPForms knows an email field
 * is an email field) and by their LABEL second. Anything not recognised is
 * kept, labelled, in `extra`, and the whole submission is stored raw as well.
 * Nothing the visitor typed is thrown away.
 *
 * Pure: no database, no network. Tested by scripts/test-lead-parse.mts.
 */

export type LeadSource = "website" | "email" | "phone" | "referral" | "walk_in" | "other";

export interface ParsedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  companyNumber: string | null;
  services: string | null;
  message: string | null;
  /** Fields we did not recognise, as "Label: value" pairs, kept for the reader. */
  extra: Array<{ label: string; value: string }>;
  formId: string | null;
  formName: string | null;
  entryId: string | null;
  pageUrl: string | null;
  /** True when the submission looks like spam. It is still stored, just filed as spam. */
  looksLikeSpam: boolean;
  spamReason: string | null;
}

interface Field {
  label: string;
  type: string;
  value: string;
}

type Role = "name" | "first" | "last" | "email" | "phone" | "company" | "companyNumber" | "services" | "message";

/* Order matters: "company number" must be tested before "company", and
   "first name" before the general "name". */
const LABEL_RULES: Array<[RegExp, Role]> = [
  [/\b(company|crn|registration)\s*(no|number|reg)\b|\bcrn\b|companies house/i, "companyNumber"],
  [/\bfirst\s*name\b|\bforename\b|\bgiven name\b/i, "first"],
  [/\b(last|sur|family)\s*name\b|\bsurname\b/i, "last"],
  [/e-?mail/i, "email"],
  [/\b(phone|mobile|tel|telephone|contact number|whatsapp)\b/i, "phone"],
  [/\b(company|business|organisation|organization|trading name|firm)\b/i, "company"],
  [/\b(service|services|interested in|help with|enquiry type|requirement)/i, "services"],
  [/\b(message|enquiry|inquiry|comments?|details|how can we help|tell us|question|notes?)\b/i, "message"],
  [/\bname\b/i, "name"],
];

const TYPE_RULES: Record<string, Role> = {
  name: "name",
  email: "email",
  phone: "phone",
  textarea: "message",
};

/** WPForms' internal / housekeeping keys that are never something a visitor typed. */
const IGNORED_KEYS = /^(form_?id|form_?name|entry_?id|page_?url|referer|referrer|_.*|nonce|token|g-recaptcha.*|h-captcha.*|cf-turnstile.*|hp|honeypot|submit|action)$/i;

function clean(v: unknown, max = 5000): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => clean(x, max)).filter(Boolean).join(", ").slice(0, max);
  if (typeof v === "object") {
    // WPForms' name field arrives as { first, middle, last } in some exports.
    const o = v as Record<string, unknown>;
    if ("first" in o || "last" in o) return [o.first, o.middle, o.last].map((x) => clean(x)).filter(Boolean).join(" ");
    return Object.values(o).map((x) => clean(x, max)).filter(Boolean).join(", ").slice(0, max);
  }
  return String(v).replace(/\u0000/g, "").trim().slice(0, max);
}

/** "first_name" → "First name". Used only to label fields we did not recognise. */
function humanise(key: string): string {
  const s = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function roleFor(f: Field): Role | null {
  const t = f.type.toLowerCase();
  // A label is more specific than a generic type: a "text" field labelled
  // "Company name" is the company, but an "email" field is an email whatever
  // it is called.
  if (t === "email") return "email";
  if (t === "phone") return "phone";
  for (const [re, role] of LABEL_RULES) if (re.test(f.label)) return role;
  return TYPE_RULES[t] ?? null;
}

function safeWebUrl(v: string): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/* Also excludes characters that would let an address smuggle extra
   recipients or headers into a mailto: link (? & , ; % and quotes). */
const EMAIL_RE = /^[^\s@<>()?&,;%"'\\]+@[^\s@<>()?&,;%"'\\]+\.[^\s@<>()?&,;%"'\\]{2,}$/;

function normaliseEmail(v: string): string | null {
  const e = v.trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}

/** Keep the digits and a leading +, so "07700 900 123" and "07700900123" match. */
function normalisePhone(v: string): string | null {
  const p = v.replace(/[^\d+]/g, "");
  return p.replace(/\D/g, "").length >= 7 ? p : null;
}

/** UK company numbers: 8 characters, digits or a two-letter prefix (SC, NI, OC…). */
function normaliseCompanyNumber(v: string): string | null {
  const s = v.replace(/\s+/g, "").toUpperCase();
  if (/^\d{1,8}$/.test(s)) return s.padStart(8, "0");
  if (/^[A-Z]{2}\d{6}$/.test(s)) return s;
  return null;
}

/**
 * Accept either shape and return a flat list of labelled fields.
 *
 *  - Bridge / WPForms: { fields: [{ name|label, type, value }, ...] } or a
 *    keyed object of the same.
 *  - Flat: { "Your name": "...", "email": "...", ... }
 */
function toFields(body: Record<string, unknown>): Field[] {
  const raw = body.fields;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];

  if (list.length) {
    return list
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        label: clean(x.label ?? x.name ?? x.id, 200),
        type: clean(x.type, 50).toLowerCase(),
        value: clean(x.value ?? x.value_raw),
      }))
      .filter((f) => f.value !== "");
  }

  return Object.entries(body)
    .filter(([k]) => !IGNORED_KEYS.test(k))
    .map(([k, v]) => ({ label: humanise(k), type: "", value: clean(v) }))
    .filter((f) => f.value !== "");
}

/* Deliberately mild. A real enquiry with one link in it must still reach a
   person, so spam is filed, never dropped, and a partner can move it back. */
function spamCheck(p: Pick<ParsedLead, "email" | "phone" | "message" | "name">, honeypot: string): string | null {
  if (honeypot) return "the hidden anti-spam field was filled in";
  if (!p.email && !p.phone) return "no email address or phone number";
  const msg = p.message ?? "";
  const links = (msg.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links >= 3) return `${links} links in the message`;
  if (/\b(seo|backlinks?|guest post|crypto|casino|viagra|loan offer|rank your (site|website))\b/i.test(msg) && links >= 1) {
    return "reads like an advertising message";
  }
  if (/[Ѐ-ӿ一-鿿]{20,}/.test(msg)) return "long message in an unexpected script";
  return null;
}

export function parseLead(input: unknown): ParsedLead {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fields = toFields(body);

  const found: Partial<Record<Role, string>> = {};
  const extra: Array<{ label: string; value: string }> = [];

  for (const f of fields) {
    const role = roleFor(f);
    if (role && !found[role]) {
      found[role] = f.value;
    } else if (role === "message" && found.message) {
      // A second free-text box (e.g. "Anything else?") is part of the message.
      found.message = `${found.message}\n\n${f.label}: ${f.value}`;
    } else {
      extra.push({ label: f.label || "Field", value: f.value });
    }
  }

  const name = found.name ?? ([found.first, found.last].filter(Boolean).join(" ") || null);

  // An email or phone typed into the wrong box still counts. Look in the
  // unrecognised fields before giving up on a way to reply.
  let email = found.email ? normaliseEmail(found.email) : null;
  let phone = found.phone ? normalisePhone(found.phone) : null;
  if (!email) {
    const hit = extra.find((x) => normaliseEmail(x.value));
    if (hit) email = normaliseEmail(hit.value);
  }
  if (!phone) {
    const hit = extra.find((x) => /^[\d\s+()-]{7,20}$/.test(x.value) && normalisePhone(x.value));
    if (hit) phone = normalisePhone(hit.value);
  }

  const lead: ParsedLead = {
    name: name ? name.slice(0, 200) : null,
    email,
    phone,
    companyName: found.company ? found.company.slice(0, 300) : null,
    companyNumber: found.companyNumber ? normaliseCompanyNumber(found.companyNumber) : null,
    services: found.services ?? null,
    message: found.message ?? null,
    extra,
    formId: clean(body.form_id ?? body.formId, 50) || null,
    formName: clean(body.form_name ?? body.formName ?? body.form_title, 200) || null,
    entryId: clean(body.entry_id ?? body.entryId, 50) || null,
    // Shown to staff as a link, and it comes from a public form: only a plain
    // web address is kept, so a "javascript:" URL can never become clickable.
    pageUrl: safeWebUrl(clean(body.page_url ?? body.pageUrl ?? body.referer, 500)),
    looksLikeSpam: false,
    spamReason: null,
  };

  const reason = spamCheck(lead, clean(body.hp ?? body.honeypot));
  lead.looksLikeSpam = reason !== null;
  lead.spamReason = reason;
  return lead;
}

/**
 * The key that stops one enquiry being stored twice.
 *
 * WordPress retries a failed send, and a visitor double-clicks Submit. With a
 * WPForms entry id the form + entry pair is unique. Without one (Lite stores no
 * entries), the same email or phone with the same message on the same day is
 * treated as the same enquiry.
 */
export function leadDedupeKey(p: ParsedLead, receivedAt: Date): string {
  if (p.formId && p.entryId) return `wpforms:${p.formId}:${p.entryId}`;
  const who = p.email ?? p.phone ?? p.name ?? "anon";
  const what = (p.message ?? "").replace(/\s+/g, " ").trim().slice(0, 200).toLowerCase();
  const day = receivedAt.toISOString().slice(0, 10);
  return `hash:${day}:${simpleHash(`${who}|${what}`)}`;
}

/** FNV-1a. Not for security: only to keep the key short. */
function simpleHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Lead stages, in the order a lead moves through them. */
export const LEAD_STATUSES = ["new", "contacted", "meeting", "proposal", "won", "lost", "spam"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  meeting: "Meeting",
  proposal: "Quote sent",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website form",
  email: "Email to info@",
  phone: "Phone call",
  referral: "Referral",
  walk_in: "Walk-in / meeting",
  other: "Other",
};
