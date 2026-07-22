/**
 * Canonical engagement letter engine.
 *
 * Produces the complete, print-ready GNS "Contract for Services" as a
 * standalone HTML document, reproducing the firm's Word template. This single
 * output is used everywhere the letter appears:
 *   - staff preview before sending
 *   - the client signing page (embedded in an iframe)
 *   - the archived copy saved on send (DB + Dropbox)
 *   - the signed copy (this HTML + e-signature audit certificate appended)
 */
import type { FirmConfig } from './firms';
import { GNS_LOGO_DATA_URI, GNS_SIGNATURE_DATA_URI } from './brand-assets';
import { SG_SIGNATURE_DATA_URI } from './sg-signature';
import { MG_SIGNATURE_DATA_URI } from './mg-signature';

const PARTNER_SIGNATURES: Record<string, string> = {
  'Lekh Nath Ghimire': GNS_SIGNATURE_DATA_URI,
  'Subash Ghimire': SG_SIGNATURE_DATA_URI,
  'Mahesh Giri': MG_SIGNATURE_DATA_URI,
};
import { buildSchedulesHtml } from './service-schedules';
import { buildTermsOfBusinessHtml, buildPrivacyNoticeHtml } from './terms-of-business';

export type LetterFrequency = 'monthly' | 'quarterly' | 'annually';
export interface LetterService { id?: string; name: string; price: number; oneoff?: boolean; frequency?: LetterFrequency }
export interface CustomFee { description: string; price: number }
export interface ScopeRow { service: string; threshold: string; excess: string }

export interface ChDetails {
  number?: string;
  status?: string;
  address?: string;
  incorporationDate?: string | null;
  aaDue?: string | null;
  csDue?: string | null;
  natureOfBusiness?: string | null;
}

export interface LetterData {
  firm: FirmConfig;
  companyName: string;
  companyNumber?: string;
  clientAddress?: string;
  directorName?: string;
  partnerName?: string; // acting partner — overrides firm default
  services: LetterService[];
  customFees?: CustomFee[];
  scopeRows?: ScopeRow[];
  ch?: ChDetails | null;
  dateStr: string;
  appUrl?: string; // absolute base for images; relative paths used when absent
  regBody?: string; // ACCA | ICAEW — overrides the firm default for the letter body
  paymentMethod?: string; // 'dd' (default) | 'manual' — manual invoices instead of Direct Debit
  includeAnnexA?: boolean; // default true; when false the SSC annex is omitted
  clientType?: string; // 'limited' | 'llp' | 'sole_trader' | 'btl' | 'partnership' | 'individual'
  clientName?: string; // client / business / trading name (for non-company types)
  utr?: string; // Unique Taxpayer Reference (self-assessment / non-company clients)
}

// Terminology + entity wording per client type, so the letter reads correctly
// for sole traders, partnerships, individuals etc. (not just limited companies).
export const CLIENT_TYPE_TERMS: Record<string, { entity: string; principals: string; heading: string; actFor: string }> = {
  limited:     { entity: 'company',     principals: 'The directors',  heading: 'Director',   actFor: 'your company' },
  llp:         { entity: 'LLP',         principals: 'The members',    heading: 'Member',     actFor: 'your LLP' },
  sole_trader: { entity: 'business',    principals: 'The proprietor', heading: 'Proprietor', actFor: 'your business' },
  btl:         { entity: 'rental business', principals: 'The client', heading: 'Client',     actFor: 'you' },
  partnership: { entity: 'partnership', principals: 'The partners',   heading: 'Partner',    actFor: 'your partnership' },
  individual:  { entity: 'tax affairs', principals: 'The client',     heading: 'Client',     actFor: 'you' },
};

export interface AuditData {
  signatureName: string;
  signedAtIso: string;
  signerEmail: string;
  companyName: string;
  companyNumber?: string;
  ipAddress?: string;
  userAgent?: string;
  documentSha256?: string;
  contactPrefs?: string[];
  ddSummary?: string | null; // masked, e.g. "S Chaulagain · ******78 · 20-**-**"
  token?: string;
  // Agreement history (Adobe Sign-style audit report)
  firmName?: string;
  firmEmail?: string;
  createdAtIso?: string | null;   // when the letter was issued
  emailedAtIso?: string | null;   // when it was emailed to the client
  firstViewedAtIso?: string | null;
  firstViewIp?: string | null;
}

// Acting partners selectable when issuing a letter
export const LETTER_PARTNERS = ['Lekh Nath Ghimire', 'Subash Ghimire', 'Mahesh Giri'];

const PARTNER_DESIGNATIONS: Record<string, string> = {
  'Lekh Nath Ghimire': 'ACCA, MBA, ICAEW (ACA), CIOT',
  'Subash Ghimire': 'ACCA, MBA',
  'Mahesh Giri': 'ACCA, MA',
};

export const DEFAULT_SCOPE_ROWS: ScopeRow[] = [
  { service: 'Annual Accounts and Corporation Tax', threshold: 'Yearly Turnover ≤ £200,000', excess: 'To be agreed later' },
  { service: 'Bookkeeping and Quarterly VAT Returns Filing', threshold: 'Turnover: As Above · Volume: 300 transactions per quarter (total of Bank Statement Lines + Purchase Bills + Sales Invoices)', excess: '£0.95 per transaction' },
  { service: 'PAYE and Pension', threshold: '2 persons including directors', excess: 'One off Setup: £10+VAT per staff · Ongoing: £10+VAT per staff per pay run' },
  { service: 'CIS', threshold: 'NA', excess: '£10+VAT per subcontractor per month' },
  { service: 'Self-Assessment (Excluding: Buy-to-Let)', threshold: '2 persons including directors', excess: '£200+VAT per year for additional person · Rental Property: To be Agreed Later' },
  { service: 'Confirmation Statement Filing to Companies House', threshold: 'Once a Year', excess: '£50+VAT for additional filing' },
  { service: 'References and Letters', threshold: '1 Letter or 1 Reference Included', excess: '£75+VAT for additional reference / letter' },
];

// Which scope row belongs to which purchasable service. Rows for services the
// client has NOT selected are excluded from the contract — showing coverage
// for unpurchased services would contractually include them by mistake.
const SCOPE_ROW_SERVICE: Array<string | null> = [
  'annual_accounts',
  'bookkeeping_vat',
  'paye',
  'cis',
  'self_assessment',
  'confirmation_statement',
  null, // References and Letters — general inclusion, shown on every engagement
];

/** Scope rows restricted to the services actually selected. */
export function scopeRowsForServices(serviceIds: string[], rows?: ScopeRow[] | null): ScopeRow[] {
  const source = rows?.length === DEFAULT_SCOPE_ROWS.length ? rows : DEFAULT_SCOPE_ROWS;
  return source.filter((_, i) => {
    const svc = SCOPE_ROW_SERVICE[i];
    return svc === null || serviceIds.includes(svc ?? '');
  });
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

import { fmtGBP } from './format';
const gbp = fmtGBP;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export function buildLetterHtml(d: LetterData): string {
  const f = d.firm;
  const partner = d.partnerName || f.partnerName;
  const regBody = d.regBody || f.regBody; // ACCA or ICAEW letter body
  const isManual = d.paymentMethod === 'manual'; // manual invoicing vs Direct Debit
  const showAnnexA = d.includeAnnexA !== false;  // annex included unless explicitly turned off
  const terms = CLIENT_TYPE_TERMS[d.clientType ?? 'limited'] ?? CLIENT_TYPE_TERMS.limited!;
  const payModeLabel = isManual ? 'Monthly Invoice' : 'Monthly DD';
  const monthly = d.services.filter((s) => !s.oneoff);
  const oneoff = d.services.filter((s) => s.oneoff);
  const customFees = (d.customFees ?? []).filter((c) => c.description.trim());
  const svcToMonthly = (s: LetterService) => {
    if (s.frequency === 'annually') return s.price / 12;
    if (s.frequency === 'quarterly') return s.price / 3;
    return s.price;
  };
  const svcToAnnual = (s: LetterService) => {
    if (s.frequency === 'annually') return s.price;
    if (s.frequency === 'quarterly') return s.price * 4;
    return s.price * 12;
  };
  const totalMonthly = monthly.reduce((s, x) => s + svcToMonthly(x), 0);
  const totalAnnual = monthly.reduce((s, x) => s + svcToAnnual(x), 0);
  const totalOneoff = oneoff.reduce((s, x) => s + x.price, 0) + customFees.reduce((s, x) => s + x.price, 0);

  // Only the scope rows for services the client actually selected appear on
  // the contract — unselected coverage clauses must never be shown.
  const monthlyIds = monthly.map((s) => s.id ?? '');
  const scopeRows = scopeRowsForServices(monthlyIds, d.scopeRows);

  // Dynamic Schedule of Services — per-service responsibilities wording
  const schedulesHtml = buildSchedulesHtml({
    serviceIds: monthlyIds,
    hasOneoff: oneoff.length > 0 || customFees.length > 0,
    firmName: f.name,
    regBody: f.regBody,
  });

  const tobOpts = { firmName: f.name, firmLegalName: f.legalName, firmAddress: `${f.address}, ${f.city} ${f.postcode}`, regBody, firmEmail: f.email };
  const termsHtml = buildTermsOfBusinessHtml(tobOpts);
  const privacyHtml = buildPrivacyNoticeHtml({ ...tobOpts, companyNumber: f.companyNumber });

  const chBox = d.ch && d.ch.number ? `
  <div class="chbox">
    <div class="chbox-h">Company Details — verified with Companies House</div>
    <div class="chbox-b">
      <p><span>Company No:</span> <strong>${esc(d.ch.number)}</strong></p>
      ${d.ch.status ? `<p><span>Status:</span> <strong style="text-transform:capitalize">${esc(d.ch.status)}</strong></p>` : ''}
      ${d.ch.address ? `<p class="w"><span>Registered Office:</span> ${esc(d.ch.address)}</p>` : ''}
      ${d.ch.incorporationDate ? `<p><span>Incorporated:</span> ${esc(fmtDate(d.ch.incorporationDate))}</p>` : ''}
      ${d.ch.natureOfBusiness ? `<p><span>SIC Code(s):</span> ${esc(d.ch.natureOfBusiness)}</p>` : ''}
      ${d.ch.aaDue ? `<p><span>Accounts due:</span> ${esc(fmtDate(d.ch.aaDue))}</p>` : ''}
      ${d.ch.csDue ? `<p><span>Confirmation statement due:</span> ${esc(fmtDate(d.ch.csDue))}</p>` : ''}
    </div>
  </div>` : '';

  const freqLabel = (f?: LetterFrequency) => f === 'annually' ? '/year' : f === 'quarterly' ? '/quarter' : '/month';
  const monthlyRows = monthly.map((s) => `
    <tr class="sub"><td>• ${esc(s.name)}${s.frequency && s.frequency !== 'monthly' ? ` <em style="color:#888;font-size:0.85em">(${freqLabel(s.frequency)})</em>` : ''}</td><td class="r">${gbp(svcToMonthly(s))}</td><td></td><td class="r">${gbp(svcToAnnual(s))}</td><td></td></tr>`).join('');

  const oneoffHeader = (oneoff.length || customFees.length) ? `
    <tr class="sect"><td colspan="5">Fees for any past due filings, catch-up and ad-hoc work (IF ANY)</td></tr>` : '';

  const oneoffRows = [
    ...oneoff.map((s) => ({ name: s.name, price: s.price })),
    ...customFees.map((c) => ({ name: c.description, price: c.price })),
  ].map((s, i) => `
    <tr class="sub"><td>${i + 1}. ${esc(s.name)}</td><td></td><td class="r">${gbp(s.price)}</td><td></td><td>One off upfront</td></tr>`).join('');

  const scopeRowsHtml = scopeRows.map((r, i) => `
    <tr${i % 2 ? ' class="alt"' : ''}><td><strong>${esc(r.service)}</strong></td><td>${esc(r.threshold)}</td><td>${esc(r.excess)}</td></tr>`).join('');

  const ssc3 = (rows: string[][]) => rows.map((r, i) =>
    `<tr${i % 2 ? ' class="alt"' : ''}>${r.map((c, j) => `<td${j > 0 ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Engagement Letter — ${esc(d.companyName)} — ${esc(f.legalName)}</title>
<style>
  @page { size: A4; margin: 24mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #24292f; font-family: Georgia, 'Times New Roman', serif;
         font-size: 12.5px; line-height: 1.75; -webkit-font-smoothing: antialiased; }
  .page { max-width: 780px; margin: 0 auto; padding: 56px 72px 44px; }
  @media (max-width: 700px) { .page { padding: 28px 22px; } }

  /* Running header/footer — repeat on every printed (or PDF) page. Chrome and
     Edge honour position:fixed on each page when printing / saving to PDF. */
  .print-header, .print-footer { display: none; }
  @media print {
    .page { padding: 0 !important; max-width: none !important; }
    table, .imp, .dd, .chbox, .sig, .parties-panel { page-break-inside: avoid; }
    h1, h2, h3 { page-break-after: avoid; }
    .lh, .rule, .rule2, .meta { display: none !important; } /* replaced by running header */
    .print-header {
      display: flex; position: fixed; top: -18mm; left: 0; right: 0; height: 15mm;
      justify-content: space-between; align-items: center;
      border-bottom: 2px solid ${f.accentColor}; padding-bottom: 4px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .print-header img { height: 12mm; }
    .print-header .n { font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #1a1f2b; }
    .print-footer {
      display: flex; position: fixed; bottom: -14mm; left: 0; right: 0; height: 10mm;
      justify-content: space-between; align-items: center;
      border-top: 1px solid #d7dbe0; padding-top: 4px;
      font-family: 'Segoe UI', Arial, sans-serif; font-size: 7.5px; color: #8a919c;
    }
  }
  .sans { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; }

  h1 { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; text-align: center;
       letter-spacing: 2.5px; text-transform: uppercase; color: #1a1f2b; margin: 30px 0 16px; font-weight: 600; }
  h2 { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; letter-spacing: 1.6px; text-transform: uppercase;
       color: ${f.accentColor}; margin: 30px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #e3e6ea; font-weight: 700; }
  h3 { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1f2b; margin: 18px 0 6px; font-weight: 700; }
  p { margin: 0 0 11px; text-align: justify; }

  /* Auto-numbered paragraphs within schedule sections */
  .schedule-body { counter-reset: clause; }
  .schedule-body h3 { counter-reset: clause; }
  .schedule-body > p { counter-increment: clause; }
  .schedule-body > p::before { content: counter(clause) ". "; font-weight: 600; color: #374151; }
  ul { margin: 0 0 11px; padding-left: 24px; }
  li { margin-bottom: 4px; }

  /* Letterhead */
  .lh { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding-bottom: 20px; }
  .lh img { height: 68px; }
  .lh .fd { text-align: right; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #5b6472; line-height: 1.7; }
  .lh .fd .n { font-weight: 700; color: #1a1f2b; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; }
  .rule { height: 3px; background: ${f.accentColor}; }
  .rule2 { height: 1px; background: #d7dbe0; margin-top: 2px; }
  .meta { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px;
          font-family: 'Segoe UI', Arial, sans-serif; color: #6b7280; }
  .meta .pc { letter-spacing: 2.5px; font-weight: 700; text-transform: uppercase; }

  /* Parties panel */
  .doc-title { text-align: center; margin-top: 34px; }
  .doc-title .kicker { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; letter-spacing: 4px;
                       text-transform: uppercase; color: ${f.accentColor}; font-weight: 700; }
  .doc-title .main { font-family: Georgia, serif; font-size: 21px; color: #1a1f2b; margin: 6px 0 0; }
  .parties-panel { border: 1px solid #d7dbe0; border-top: 3px solid ${f.accentColor}; padding: 18px 26px 14px; margin: 20px 0 8px; }
  .parties-panel .lbl { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; letter-spacing: 2.5px;
                        color: #9aa1ab; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; text-align: left; }
  .parties-panel .pty { font-size: 13px; margin: 0 0 12px; text-align: left; line-height: 1.55; }
  .integral { text-align: center; font-style: italic; color: #6b7280; font-size: 11px; margin: 10px 0 24px; }

  /* Companies House verification panel */
  .chbox { border: 1px solid #d7dbe0; margin: 0 0 24px; }
  .chbox-h { font-family: 'Segoe UI', Arial, sans-serif; padding: 8px 16px; background: #f6f7f9; border-bottom: 1px solid #e3e6ea;
             font-weight: 700; font-size: 10px; color: #3b4453; letter-spacing: 1.5px; text-transform: uppercase; }
  .chbox-b { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 26px; padding: 12px 16px;
             font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #374151; }
  .chbox-b p { margin: 0; text-align: left; }
  .chbox-b span { color: #8a919c; }
  .chbox-b .w { grid-column: 1 / -1; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-family: 'Segoe UI', Arial, sans-serif; }
  .fees th { background: #1a1f2b; color: #fff; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase;
             padding: 9px 11px; text-align: left; font-weight: 600; }
  .fees td { border-bottom: 1px solid #e8eaee; padding: 8px 11px; font-size: 11.5px; color: #24292f; }
  .fees .r { text-align: right; font-variant-numeric: tabular-nums; }
  .fees .sub td { color: #5b6472; font-size: 11px; border-bottom: 1px solid #f1f2f5; }
  .fees .sect td { background: #f6f7f9; font-weight: 700; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; color: #3b4453; }
  .fees .total td { background: #f6f7f9; font-weight: 700; border-top: 2px solid #1a1f2b; border-bottom: 2px solid #1a1f2b; font-size: 12px; }
  .vatnote { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600; font-size: 10.5px; color: #5b6472;
             margin: 4px 0 26px; text-align: right; }

  /* Callouts */
  .imp { border-left: 4px solid ${f.accentColor}; background: #fbf7f7; padding: 12px 18px; margin: 0 0 26px;
         font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; }
  .imp .t { color: ${f.accentColor}; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; font-size: 10.5px; margin-bottom: 4px; }
  .imp p, .dd p { text-align: left; margin: 0; line-height: 1.65; }
  .dd { border-left: 4px solid #3b4453; background: #f6f7f9; padding: 12px 18px; margin: 0 0 26px;
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; }
  .dd .t { font-weight: 700; letter-spacing: 1px; text-transform: uppercase; font-size: 10.5px; color: #3b4453; margin-bottom: 4px; }

  .scope th { background: #1a1f2b; color: #fff; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase;
              padding: 9px 11px; text-align: left; font-weight: 600; }
  .scope td { border-bottom: 1px solid #e8eaee; padding: 8px 11px; font-size: 11px; vertical-align: top; color: #374151; }
  .scope .alt td { background: #fafbfc; }
  .scope strong { color: #1a1f2b; }

  .ssc th { background: #f6f7f9; font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; color: #3b4453;
            padding: 7px 10px; border-bottom: 2px solid #d7dbe0; text-align: left; font-weight: 700; }
  .ssc td { border-bottom: 1px solid #eceef1; padding: 6px 10px; font-size: 10.5px; color: #374151; }
  .ssc .r { text-align: right; font-variant-numeric: tabular-nums; }
  .ssc .alt td { background: #fafbfc; }
  .ssc-h { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
           letter-spacing: 1.2px; color: ${f.accentColor}; margin: 20px 0 6px; }

  /* Signature */
  .sig { margin: 22px 0; }
  .sig img { height: 62px; display: block; margin-bottom: 2px; }
  .sig .line { width: 240px; border-top: 1px solid #9aa1ab; margin: 4px 0 6px; }
  .sig .n { font-weight: bold; font-size: 13px; }
  .sig .r { color: #5b6472; font-size: 11px; font-family: 'Segoe UI', Arial, sans-serif; }

  .divider { border: 0; border-top: 1px solid #d7dbe0; margin: 36px 0 26px; position: relative; }
  .foot { border-top: 1px solid #e3e6ea; margin-top: 40px; padding-top: 14px; font-size: 9px; color: #9aa1ab;
          font-family: 'Segoe UI', Arial, sans-serif; text-align: center; line-height: 1.7; }
  .center { text-align: center; }
</style>
</head>
<body>
<div class="print-header">
  <img src="${GNS_LOGO_DATA_URI}" alt="">
  <span class="n">${esc(f.legalName)}</span>
</div>
<div class="print-footer">
  <span>${esc(f.address)}, ${esc(f.city)}, ${esc(f.postcode)} · ${esc(f.email)} · ${esc(f.phone)}</span>
  <span>${esc(f.regBody)} Regulated</span>
</div>
<div class="page">

  <div class="lh">
    <img src="${GNS_LOGO_DATA_URI}" alt="${esc(f.name)}">
    <div class="fd">
      <div class="n">${esc(f.legalName)}</div>
      ${esc(f.address)} · ${esc(f.city)} ${esc(f.postcode)}<br>
      ${esc(f.phone)} · ${esc(f.email)}<br>
      ${esc(f.website)}
    </div>
  </div>
  <div class="rule"></div>
  <div class="rule2"></div>
  <div class="meta">
    <span class="pc">Private &amp; Confidential</span>
    <span>Date: <strong>${esc(d.dateStr)}</strong></span>
  </div>

  <div class="doc-title">
    <div class="kicker">Letter of Engagement</div>
    <div class="main">Contract for Services</div>
  </div>

  <div class="parties-panel">
    <p class="lbl">Between</p>
    <p class="pty"><strong>${esc(f.legalName.toUpperCase())}</strong> of ${esc(f.address)}, ${esc(f.city)} ${esc(f.postcode)} (‘The Accountants’)</p>
    <p class="lbl">And</p>
    <p class="pty" style="margin-bottom:2px"><strong>${esc(d.companyName.toUpperCase())}</strong>${d.clientAddress ? ` of ${esc(d.clientAddress)}` : ''}${d.companyNumber ? ` (Company No. ${esc(d.companyNumber)})` : ''} (‘The Client’)</p>
  </div>
  <p class="integral">This fee structure and quotation is an integral part of the engagement letter.</p>

  ${chBox}

  <table class="fees sans">
    <thead>
      <tr><th>Fees</th><th style="width:78px;text-align:right">Monthly £</th><th style="width:92px;text-align:right">Fees Upfront £</th><th style="width:110px;text-align:right">Annual Equivalent £</th><th style="width:96px">Payment Mode</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Fees Agreed</strong></td><td class="r"><strong>${gbp(totalMonthly)}</strong></td><td class="r">—</td><td class="r">${gbp(totalAnnual)}</td><td>${payModeLabel}</td></tr>
      ${monthlyRows}
      ${oneoffHeader}
      ${oneoffRows}
      <tr class="total"><td>Final Monthly and One off Fees Agreed</td><td class="r">${gbp(totalMonthly)}</td><td class="r">${gbp(totalOneoff)}</td><td class="r">${gbp(totalAnnual)}</td><td style="font-size:10.5px">${payModeLabel}<br>One off Upfront</td></tr>
    </tbody>
  </table>
  <p class="vatnote sans">Note: 20% VAT applies to all above</p>

  ${isManual ? `
  <div class="dd sans">
    <div class="t">Payment — Monthly Invoice</div>
    <p style="text-align:left">The Client's fees are invoiced monthly and are payable within 14 days of the invoice date.
    Fees for one-off and ad-hoc work are invoiced on completion and payable upfront. No Direct Debit mandate is
    required for this engagement.</p>
  </div>` : `
  <div class="dd sans">
    <div class="t">Direct Debit — GoCardless Mandate</div>
    <p style="text-align:left">The Client's fees are collected by GoCardless Direct Debit. By signing this contract the Client authorises
    ${esc(f.name)} to collect fees using GoCardless direct debit and authorises the use of the bank details provided at
    signing for direct debit setup on the Client's behalf. Payments are protected by the Direct Debit Guarantee.</p>
  </div>`}

  <div class="imp sans">
    <div class="t">Important!</div>
    Please read the contract to the last page and return to the signature section. <strong>Do not sign unless you have
    read and understood the contract in its entirety.</strong>
  </div>

  <p class="sans" style="font-weight:bold;font-size:12px">Services not covered below will be as per our Schedule of Service Charges (SSC) included in Annex A of this contract (last page).</p>
  <table class="scope sans">
    <thead><tr><th style="width:31%">Scope of Services</th><th style="width:36%">Coverage Threshold (What is included?)</th><th>Fee Exceeding Scope</th></tr></thead>
    <tbody>${scopeRowsHtml}</tbody>
  </table>

  <hr class="divider">

  <p style="font-weight:bold;margin-bottom:2px">${esc(terms.principals)}</p>
  <p style="font-weight:bold">${esc(d.clientName || d.companyName)}</p>
  ${d.utr ? `<p style="font-size:11px;color:#374151">UTR: <strong>${esc(d.utr)}</strong></p>` : ''}
  <p>Dear Sir/s</p>
  <p>We are pleased to accept the instruction to act as accountant for ${esc(terms.actFor)} and are writing to confirm the terms of our appointment.</p>
  <p>The purpose of this letter, together with the attached terms and conditions, is to set out our terms for carrying out the work and to clarify our respective responsibilities.</p>
  <p>We are bound by the ${regBody === 'ICAEW' ? 'Code of Ethics of the Institute of Chartered Accountants in England and Wales (ICAEW)' : 'ethical guidelines of the Association of Chartered Certified Accountants (ACCA)'} and accept instructions to act for you on the basis that we will act in accordance with those ethical guidelines. A copy of these guidelines can be viewed at our offices on request${regBody === 'ACCA' ? ' or at www.accaglobal.com' : ' or at www.icaew.com'}.</p>

  <h2>Period of engagement</h2>
  <p>This letter is effective from the date signed.</p>
  <p>We will deal with matters arising in respect of periods prior to the above date as appropriate should there be any such requirement.</p>

  <h2>Scope of services to be provided</h2>
  <h3>Our responsibility to you</h3>
  <p>We have set out the agreed scope and objectives of your instructions within this letter of engagement. Any subsequent changes will be discussed with you and where appropriate a new letter of engagement will be agreed. We shall proceed on the basis of the instructions we have received from you and will rely on you to tell us as soon as possible if anything occurs which renders any information previously given to us as incorrect or inaccurate. We shall not be responsible for any failure to advise or comment on any matter that falls outside the specific scope of your instructions. We cannot accept any responsibility for any event, loss or situation unless it is one against which it is the expressed purpose of these instructions to provide protection.</p>
  <h3>Your responsibility to us</h3>
  <p>The advice that we give can only be as good as the information on which it is based. In so far as that information is provided by you, or by third parties with your permission, your responsibility arises as soon as possible if any circumstances or facts alter, as any alteration may have a significant impact on the advice given. If the circumstances change therefore or your needs alter, advise us of the alteration as soon as possible in writing.</p>
  <h3>Statutory responsibilities</h3>
  <p>As directors of the company, you are required by statute to prepare accounts (financial statements) for each financial year, which give a true and fair view of the state of affairs of the company and of its profit or loss for that period. In preparing those accounts you must:</p>
  <ul>
    <li>Select suitable accounting policies and then apply them consistently.</li>
    <li>Make judgements and estimates that are reasonable and prudent.</li>
    <li>Prepare the accounts on the going concern basis unless it is not appropriate to presume that the company will continue in business.</li>
  </ul>
  <p>You have engaged us to prepare the accounts on your behalf.</p>
  <p>It is your responsibility to keep proper accounting records that disclose with reasonable accuracy at any particular time the financial position of the company. It is also your responsibility to safeguard the assets of the company and to take reasonable steps for the prevention of and detection of fraud and other irregularities with an appropriate system of internal controls.</p>
  <p>You are responsible for determining whether, in respect of the year concerned, the company meets the conditions for exemption from an audit set out in section 477 of the Companies Act 2006, and for determining whether, in respect of the year, the exemption is not available for any of the reasons set out in section 478 of the Companies Act 2006.</p>
  <p>You are also responsible for making available to us, as and when required, all the company's accounting records and all other relevant records and related information, including minutes of management and shareholders' meetings.</p>
  <p>You will also be responsible for:</p>
  <ul>
    <li>Maintaining records of all receipts and payments of cash.</li>
    <li>Maintaining records of invoices issued and received.</li>
    <li>Reconciling balances monthly/annually with the bank statements.</li>
    <li>Preparing details of the following at the year-end: stocks and work in progress; fixed assets; amounts owing to suppliers; amounts owing by customers; and accruals and prepayments.</li>
  </ul>
  <p>Our work will not be an audit of the accounts in accordance with International Standards on Auditing (UK and Ireland). Accordingly, we shall not seek any independent evidence to support the entries in the accounting records, or to prove the existence, ownership or valuation of assets or completeness of income, liabilities or disclosure in the accounts. Nor shall we assess the reasonableness of any estimates or judgements made in the preparation of the accounts. Consequently, our work will not provide any assurance that the accounting records are free from material misstatement, irregularities or error.</p>
  <p>As part of our normal procedures we may request you to provide written confirmation of any oral information and explanations given to us during the course of our work.</p>
  <p>We have a professional duty to compile accounts that conform with generally accepted accounting principles. The accounts of a limited company are required to comply with the disclosure requirements of the Companies Act 2006 and applicable accounting standards. Where we identify that the accounts do not conform to accepted accounting principles or standards, we will inform you and suggest amendments be put through the accounts before being published. We have a professional responsibility not to allow our name to be associated with accounts that may be misleading. In extreme cases, where this matter cannot be resolved, we will withdraw from the engagement and notify you in writing of the reasons.</p>
  <p>Should you instruct us to carry out any alternative report it will be necessary for us to issue a separate letter of engagement.</p>
  <h3>Our service to you</h3>
  <p>We will not be carrying out any audit work as part of this assignment and accordingly will not verify the assets and liabilities of the company, nor the items of expenditure and income. To carry out an audit would entail additional work to comply with International Standards on Auditing so that we could report on the truth and fairness of the financial statements. We would also like to emphasise that we cannot undertake to discover any shortcomings in your systems or irregularities on the part of your employees.</p>
  <p>If an audit of the accounts is required, you will need to notify us in writing. Should our work indicate that the company is not entitled to exemption from an audit of the accounts, we will inform you. If we decide to undertake an audit assignment at your request, a separate engagement letter will be required.</p>
  <p>We will attach to the accounts a report developed by the Consultative Committee of Accountancy Bodies (CCAB) which explains what work has been done by us, the professional requirements we have to fulfil and the standard to which the work has been carried out. To ensure that anyone reading the accounts is aware that we have not carried out an audit, we will attach to the accounts a report stating this fact.</p>
  <p>The intended users of the report are the directors. The report will be addressed to the directors.</p>
  <p>Once we have issued our report we have no further direct responsibility in relation to the accounts for that financial year. However, we expect that you will inform us of any material event occurring between the date of our report and that of the annual general meeting that may affect the accounts.</p>
  <h3>Limitation of liability</h3>
  <p>We specifically draw your attention to the limitation of liability paragraphs in our standard terms and conditions which set out the basis on which we limit our liability to you and to others. You should read this in conjunction with the limitation of third party rights paragraphs in our standard terms and conditions which exclude liability to third parties. These are important provisions which you should read and consider carefully.</p>
  <p>There are no third parties that we have agreed should be entitled to rely on the work done pursuant to this engagement letter.</p>

  <h2>Other services</h2>
  <p>You may request that we provide other services from time to time. If these services will exceed £200, we will issue a separate letter of engagement and scope of work to be performed accordingly.</p>
  <p>Because rules and regulations frequently change you must ask us to confirm any advice already given if a transaction is delayed or a similar transaction is to be undertaken.</p>

  <h2>Electronic signature</h2>
  <p>This contract is executed by electronic signature. In accordance with the Electronic Communications Act 2000, the Electronic Identification and Trust Services for Electronic Transactions Regulations 2016 (UK eIDAS) and the Law Commission's 2019 Statement on the Electronic Execution of Documents, an electronic signature (including a typed name entered with intent to sign) is legally valid and binding in England and Wales. By typing their name in the signature box and submitting, the signatory confirms their intention to be bound by this contract. A tamper-evident audit record (signatory, date and time, network address and document fingerprint) is retained with the signed copy, and a copy of the signed contract is provided to the Client for their records.</p>

  <h2>Data Protection</h2>
  <p>We comply with the provisions of the General Data Protection Regulation (GDPR) when processing personal data about you, your directors and employees and your/their family.</p>
  <p>Processing means:</p>
  <ul>
    <li>obtaining, recording or holding personal data; or</li>
    <li>carrying out any operation or set of operations on personal data, including collecting and storage, organising, adapting, altering, using, disclosure (by any means) or removing (by any means) from the records manual and digital.</li>
  </ul>
  <p>The information we obtain, process, use and disclose will be necessary for:</p>
  <ul>
    <li>the performance of the contract</li>
    <li>to comply with our legal and regulatory compliance and crime prevention</li>
    <li>contacting you with details of other services where you have consented to us doing so</li>
    <li>other legitimate interests relating to protection against potential claims and disciplinary action against us.</li>
  </ul>
  <p>This includes, but is not limited to, purposes such as updating and enhancing our client records, analysis for management purposes and statutory returns.</p>
  <p>In regard to our professional obligations we are a member firm of the ${esc(regBody)}. Under the ethical and regulatory rules of ${esc(regBody)}, we are required to allow access to client files and records for the purpose of maintaining our membership of this body.</p>
  <p>Further details on the processing of data are contained in our privacy notice, which should be read alongside these terms and conditions.</p>
  <h3>Requirements of the Data Protection Act (DPA) 2018 and the General Data Protection Regulation (GDPR)</h3>
  <p>The DPA 2018 and GDPR set out a number of requirements in relation to the processing of personal data.</p>
  <p>Here at ${esc(f.name)}, we take your privacy and the privacy of the information we process seriously. We will only use your personal information and the personal information you give us access to under this contract to administer your account and to provide the services you have requested from us. Bank details provided for the Direct Debit mandate are used solely for that purpose and are transmitted securely to our payment provider.</p>
  <h3>(a) Continuity arrangements</h3>
  <p>Please note that we have arrangements in place for an alternate to deal with matters in the event of permanent incapacity or illness. This provides protection to you in the event that we cannot act on your behalf, and in signing this letter you agree to the alternate having access to all of the information we hold in order to make initial contact with you and agree the work to be undertaken during any incapacity. You can choose to appoint another agent at that stage if you wish.</p>
  <h3>(b) Secure communications and transfer of data</h3>
  <p>We will communicate or transfer data using the following:</p>
  <ul>
    <li>Post/hard-copy documents [by normal or recorded delivery]</li>
    <li>Password-protected attachments in emails</li>
    <li>Encrypted emails</li>
    <li>Secure cloud-based software for electronic signature</li>
    <li>Emails *</li>
    <li>Social media – Text, Viber, Whatsapp</li>
  </ul>
  <p>* If you require us to correspond with you by email that is not encrypted or password protected, you also accept the risks associated with this form of communication.</p>
  <h3>(c) Other services — contact preferences</h3>
  <p>From time to time we would like to contact you with details of other services we provide. Your chosen contact preferences are recorded in the acceptance section of this contract.</p>

  <h2>Agreement of terms</h2>
  <p>This letter supersedes any previous engagement letter. Once it has been agreed, this letter will remain effective until it is replaced.</p>
  <p>You or we may vary or terminate our authority to act on your behalf at any time without penalty. Notice of variation or termination must be given in writing.</p>
  <p>We would be grateful if you could confirm your agreement to the terms of this letter by signing in the acceptance section.</p>
  <p>If this letter is not in accordance with your understanding of the scope of our engagement or your circumstances have changed, please let us know. This letter should be read in conjunction with the firm's standard terms and conditions.</p>

  <p>Yours sincerely,</p>
  <div class="sig">
    <img src="${PARTNER_SIGNATURES[partner] || GNS_SIGNATURE_DATA_URI}" alt="">
    <div class="line"></div>
    <div class="n">${esc(partner)}${PARTNER_DESIGNATIONS[partner] ? `, ${esc(PARTNER_DESIGNATIONS[partner])}` : ''}</div>
    <div class="r">Director, ${esc(f.legalName)}</div>
  </div>
  <p>I/We confirm that I/we have read and understood the contents of this letter and related terms and conditions and agree that it accurately reflects my/our fair understanding of the services that I/we require you to undertake.</p>

  <hr class="divider">

  <h1 style="letter-spacing:1px">SCHEDULE OF SERVICES</h1>
  <p>This section provides a full explanation of the services you have engaged us to carry out, and should be read in conjunction with the engagement letter and the terms and conditions of business. Only the services listed in these schedules are included within the scope of our instructions.</p>
  ${schedulesHtml}
  ${termsHtml}
  ${privacyHtml}
  ${showAnnexA ? `
  <hr class="divider">

  <h2 class="sans" style="font-size:14px">Annex A: Schedule of Service Charges (SSC)</h2>
  <p class="sans" style="font-size:11px;color:#6b7280">Ad-hoc and specialist services not included in your monthly fee are charged as follows:</p>

  <div class="ssc-h sans">Self-Assessment (SA) Tax Return (SATR)</div>
  <table class="ssc sans">
    <thead><tr><th>Service</th><th style="text-align:right">Single</th><th style="text-align:right">Couple</th></tr></thead>
    <tbody>${ssc3([
      ['Buy to Let SA Filing', '£250+VAT', '£350+VAT'],
      ['Director and other SA (Salary, Dividend)', '£200+VAT', '£375+VAT'],
      ['Sole Trader (Self Employed with GNS to do bookkeeping)', '£350+VAT', 'NA'],
      ['Change of Beneficial Ownership for Rental Property Owners', '£500+VAT (New)', '£400+VAT (Existing)'],
    ])}</tbody>
  </table>

  <div class="ssc-h sans">MTD Filing for Self-Assessment and Annual Summary</div>
  <table class="ssc sans">
    <thead><tr><th>Service</th><th style="text-align:right">Single</th><th style="text-align:right">Couple</th></tr></thead>
    <tbody>${ssc3([
      ['Quarterly', '£75+VAT / quarter', '£150+VAT / quarter'],
      ['Annual Summary Filing', 'Free', 'Free'],
      ['BTL / SA Filing (same as above)', '£250+VAT', '£350+VAT'],
      ['Total Fee for SA Filing when MTD comes to full force', '£550+VAT', '£850+VAT'],
    ])}</tbody>
  </table>

  <div class="ssc-h sans">Compliance &amp; Tax Registration Services</div>
  <table class="ssc sans">
    <thead><tr><th>Service</th><th style="text-align:right">Companies House Charges</th><th style="text-align:right">GNS Fee</th><th style="text-align:right">VAT</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${ssc3([
      ['Company Registration', '£100.00', '£125.00', '£25.00', '£250.00'],
      ['Company Registration — Same Day', '£156.00', '£200.00', '£40.00', '£396.00'],
      ['Change of Name', '£20.00', '£75.00', '£15.00', '£110.00'],
      ['Same Day Change of Name', '£85.00', '£150.00', '£30.00', '£265.00'],
      ['Confirmation Statement Filing', '£50.00', '£50.00', '£10.00', '£110.00'],
      ['Voluntary Strike Off DS01', '£14.00', '£100.00', '£20.00', '£134.00'],
      ['Charge Registration', '£15.00', '£50.00', '£10.00', '£75.00'],
      ['Certificate of Good Standing', '£15.00', '£50.00', '£10.00', '£75.00'],
      ['Certificate of Good Standing — Express', '£50.00', '£75.00', '£15.00', '£140.00'],
      ['Shareholding Changes', '—', '£50.00', '£10.00', '£60.00'],
      ['Director Appointment / Termination', '—', '£50.00', '£10.00', '£60.00'],
      ['Company / Directors’ Address Changes', '—', '£50.00', '£10.00', '£60.00'],
      ['Companies House Identity Verification', '—', '£75.00', '£15.00', '£90.00'],
      ['Reference Letters and Forms', '—', '£100.00', '£20.00', '£120.00'],
      ['PAYE Registration', '—', '£100.00', '£20.00', '£120.00'],
      ['VAT Registration', '—', '£75.00', '£15.00', '£90.00'],
      ['Self-Assessment Registration', '—', '£100.00', '£20.00', '£120.00'],
    ])}</tbody>
  </table>

  <div class="ssc-h sans">Subscription Based Services</div>
  <table class="ssc sans">
    <thead><tr><th>Service</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${ssc3([
      ['Registered Office Address', '£20+VAT (Monthly)'],
      ['QuickBooks Subscription', '£25+VAT (Monthly)'],
    ])}</tbody>
  </table>` : ''}

  <div class="foot sans">${esc(f.regStatement)}</div>
</div>
</body>
</html>`;
}

/**
 * E-signature audit report — appended to the letter when the client signs,
 * forming the tamper-evident signed copy (UK eIDAS / ECA 2000 / GDPR).
 * Formatted as a e-Sign Audit Trail with agreement history, matching the
 * industry standard (Adobe Sign) layout the firm previously used.
 */
export function buildAuditCertificate(a: AuditData): string {
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (Europe/London)';
  };
  const signedAt = new Date(a.signedAtIso);
  const txId = a.token ? `GNS-${a.token.substring(0, 20).toUpperCase()}` : '—';
  const docName = `Engagement Letter — ${a.companyName}`;

  const event = (title: string, when: string | null | undefined, extra?: string | null) => {
    if (!when) return '';
    return `
    <div style="border-left:3px solid #cbd2da;padding:4px 0 4px 16px;margin:0 0 12px">
      <p style="margin:0;font-size:11.5px;font-weight:bold;color:#1a1f2b">${title}</p>
      <p style="margin:2px 0 0;font-size:10.5px;color:#6b7280">${esc(when)}${extra ? ` — ${esc(extra)}` : ''}</p>
    </div>`;
  };

  const row = (k: string, v: string | null | undefined) =>
    v ? `<tr><td style="border:1px solid #d7dbe0;padding:6px 10px;font-size:10.5px;font-weight:bold;background:#f6f7f9;width:210px">${esc(k)}</td><td style="border:1px solid #d7dbe0;padding:6px 10px;font-size:10.5px;font-family:Consolas,monospace;word-break:break-all">${esc(v)}</td></tr>` : '';

  const firm = a.firmName ?? 'GNS Associates';
  const firmEmail = a.firmEmail ?? '';

  return `
<div class="page" style="max-width:780px;margin:0 auto;padding:56px 72px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;page-break-before:always">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #16a34a;padding-bottom:14px;margin-bottom:18px">
    <div>
      <p style="margin:0;font-size:16px;font-weight:bold;color:#166534">✓ e-Sign Audit Trail</p>
      <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${esc(docName)}</p>
    </div>
    <p style="margin:0;font-size:10.5px;color:#6b7280">${signedAt.toLocaleDateString('en-GB')}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    ${row('Created by', `${firm}${firmEmail ? ` (${firmEmail})` : ''}`)}
    ${row('Status', 'Signed — agreement complete')}
    ${row('Transaction ID', txId)}
    ${row('Document fingerprint (SHA-256)', a.documentSha256)}
  </table>

  <h2 style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#1a1f2b;margin:0 0 4px">Agreement History</h2>
  <p style="font-size:10.5px;color:#6b7280;margin:0 0 14px">The list of events that led to the final signature of this agreement.</p>

  ${event(`Document created by ${esc(firm)}${firmEmail ? ` (${esc(firmEmail)})` : ''}`, fmt(a.createdAtIso))}
  ${event(`Document emailed to ${esc(a.signerEmail)} for signature`, fmt(a.emailedAtIso ?? a.createdAtIso))}
  ${event(`Document viewed by ${esc(a.signerEmail)}`, fmt(a.firstViewedAtIso), a.firstViewIp ? `IP address: ${a.firstViewIp}` : null)}
  ${event(`Document e-signed by ${esc(a.signatureName)} (${esc(a.signerEmail)})`, fmt(a.signedAtIso), a.ipAddress ? `IP address: ${a.ipAddress}` : null)}
  ${event('Agreement completed', fmt(a.signedAtIso))}

  <h2 style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#1a1f2b;margin:22px 0 8px">Signature Details</h2>
  <table style="width:100%;border-collapse:collapse">
    ${row('Signatory (typed signature)', a.signatureName)}
    ${row('Signatory email', a.signerEmail)}
    ${row('Signing on behalf of', `${a.companyName}${a.companyNumber ? ` (Company No. ${a.companyNumber})` : ''}`)}
    ${row('Date & time of signature (UTC)', signedAt.toISOString())}
    ${row('Date & time (UK)', fmt(a.signedAtIso))}
    ${row('Network (IP) address', a.ipAddress)}
    ${row('Browser / device', a.userAgent)}
    ${row('Contact preferences', (a.contactPrefs ?? []).join(', ') || undefined)}
    ${row('Direct Debit mandate', a.ddSummary ?? undefined)}
  </table>

  <p style="font-size:9.5px;color:#8a919c;margin-top:16px;line-height:1.7">
    Legal notice: This document was signed electronically. Under the Electronic Communications Act 2000, the UK eIDAS
    Regulations (SI 2016/696, as amended) and the Law Commission's 2019 Statement on the Electronic Execution of
    Documents, an electronic signature is admissible in evidence and legally valid in England and Wales. The signatory
    confirmed their intention to be bound before signing and verified their email address against the address to which
    the signing link was issued. The document fingerprint above is the SHA-256 hash of the contract as presented at the
    point of signature; any alteration to the document after signing will produce a different fingerprint. Personal
    data in this report is processed for contract performance and legal compliance under UK GDPR Article 6(1)(b) and
    (c) and retained in accordance with the firm's data retention policy.
  </p>
</div>`;
}

/** Insert the audit certificate before </body> of a letter document. */
export function buildSignedHtml(letterHtml: string, audit: AuditData): string {
  const cert = buildAuditCertificate(audit);
  return letterHtml.includes('</body>')
    ? letterHtml.replace('</body>', `${cert}</body>`)
    : letterHtml + cert;
}
