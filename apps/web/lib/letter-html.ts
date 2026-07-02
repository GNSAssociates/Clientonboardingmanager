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

export interface LetterService { id?: string; name: string; price: number; oneoff?: boolean }
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
}

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
}

// Acting partners selectable when issuing a letter
export const LETTER_PARTNERS = ['Subash Ghimire', 'Lekh Nath Ghimire', 'Mahesh Ghimire'];

export const DEFAULT_SCOPE_ROWS: ScopeRow[] = [
  { service: 'Annual Accounts and Corporation Tax', threshold: 'Yearly Turnover ≤ £200,000', excess: 'To be agreed later' },
  { service: 'Bookkeeping and Quarterly VAT Returns Filing', threshold: 'Turnover: As Above · Volume: 300 transactions per quarter (total of Bank Statement Lines + Purchase Bills + Sales Invoices)', excess: '£0.95 per transaction' },
  { service: 'PAYE and Pension', threshold: '2 persons including directors', excess: 'One off Setup: £10+VAT per staff · Ongoing: £10+VAT per staff per pay run' },
  { service: 'CIS', threshold: 'NA', excess: '£10+VAT per subcontractor per month' },
  { service: 'Self-Assessment (Excluding: Buy-to-Let)', threshold: '2 persons including directors', excess: '£200+VAT per year for additional person · Rental Property: To be Agreed Later' },
  { service: 'Confirmation Statement Filing to Companies House', threshold: 'Once a Year', excess: '£50+VAT for additional filing' },
  { service: 'References and Letters', threshold: '1 Letter or 1 Reference Included', excess: '£75+VAT for additional reference / letter' },
];

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const gbp = (n: number) => `£${n.toFixed(2)}`;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export function buildLetterHtml(d: LetterData): string {
  const f = d.firm;
  const base = d.appUrl && !d.appUrl.startsWith('http://localhost') ? d.appUrl : '';
  const partner = d.partnerName || f.partnerName;
  const scopeRows = d.scopeRows?.length ? d.scopeRows : DEFAULT_SCOPE_ROWS;
  const monthly = d.services.filter((s) => !s.oneoff);
  const oneoff = d.services.filter((s) => s.oneoff);
  const customFees = (d.customFees ?? []).filter((c) => c.description.trim());
  const totalMonthly = monthly.reduce((s, x) => s + x.price, 0);
  const totalOneoff = oneoff.reduce((s, x) => s + x.price, 0) + customFees.reduce((s, x) => s + x.price, 0);

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

  const monthlyRows = monthly.map((s) => `
    <tr class="sub"><td>• ${esc(s.name)}</td><td class="r">${gbp(s.price)}</td><td></td><td class="r">${gbp(s.price * 12)}</td><td></td></tr>`).join('');

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
  @page { size: A4; margin: 18mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #1f2430; font-family: Georgia, 'Times New Roman', serif;
         font-size: 13px; line-height: 1.65; }
  .page { max-width: 794px; margin: 0 auto; padding: 48px 64px; }
  @media (max-width: 700px) { .page { padding: 24px 20px; } }
  @media print { .page { padding: 0; max-width: none; } }
  .sans { font-family: Arial, Helvetica, sans-serif; }
  h1 { font-size: 17px; text-align: center; margin: 26px 0 14px; }
  h2 { font-size: 14.5px; margin: 26px 0 8px; }
  h3 { font-size: 13.5px; margin: 18px 0 6px; }
  p { margin: 0 0 10px; text-align: justify; }
  ul { margin: 0 0 10px; padding-left: 26px; }
  li { margin-bottom: 4px; }
  .lh { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
        border-bottom: 3px solid ${f.accentColor}; padding-bottom: 18px; }
  .lh img { height: 74px; }
  .lh .fd { text-align: right; font-size: 11.5px; color: #4b5563; line-height: 1.5; }
  .lh .fd .n { font-weight: bold; color: #111; font-size: 12.5px; }
  .meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 11px; }
  .meta .pc { letter-spacing: 2px; font-weight: bold; color: #6b7280; text-transform: uppercase; }
  .parties { text-align: center; margin-bottom: 4px; }
  .integral { text-align: center; font-style: italic; color: #4b5563; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
  .fees th { background: ${f.accentColor}; color: #fff; font-size: 11.5px; padding: 7px 9px; border: 1px solid #9ca3af; text-align: left; }
  .fees td { border: 1px solid #c5cad3; padding: 6px 9px; font-size: 12px; }
  .fees .r { text-align: right; }
  .fees .sub td { color: #4b5563; font-size: 11.5px; }
  .fees .sect td { background: #f3f4f6; font-weight: bold; }
  .fees .total td { background: #e9ebf0; font-weight: bold; border-color: #9ca3af; }
  .vatnote { font-weight: bold; font-size: 11.5px; margin-bottom: 22px; }
  .imp { border: 2px solid ${f.accentColor}; background: #fff7f7; padding: 12px 16px; margin: 0 0 22px; }
  .imp .t { color: ${f.accentColor}; font-weight: bold; margin-bottom: 4px; }
  .scope th { background: #374151; color: #fff; font-size: 11.5px; padding: 7px 9px; border: 1px solid #9ca3af; text-align: left; }
  .scope td { border: 1px solid #c5cad3; padding: 6px 9px; font-size: 11.5px; vertical-align: top; }
  .scope .alt td { background: #f8f9fb; }
  .ssc th { background: #eceef2; font-size: 11px; padding: 6px 8px; border: 1px solid #c5cad3; text-align: left; }
  .ssc td { border: 1px solid #c5cad3; padding: 5px 8px; font-size: 11px; }
  .ssc .r { text-align: right; }
  .ssc .alt td { background: #f8f9fb; }
  .ssc-h { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.6px; color: #374151; margin: 14px 0 5px; }
  .dd { border: 2px solid #6b7280; padding: 12px 16px; margin: 0 0 22px; font-size: 12px; }
  .dd .t { font-weight: bold; margin-bottom: 6px; }
  .sig { margin: 18px 0; }
  .sig img { height: 64px; display: block; }
  .sig .n { font-weight: bold; margin-top: 4px; }
  .sig .r { color: #4b5563; font-size: 12px; }
  .divider { border: 0; border-top: 2px solid #d1d5db; margin: 30px 0 22px; }
  .foot { border-top: 1px solid #e5e7eb; margin-top: 34px; padding-top: 12px; font-size: 10px; color: #9ca3af; }
  .center { text-align: center; }
</style>
</head>
<body>
<div class="page">

  <div class="lh">
    <img src="${base}${f.logo}" alt="${esc(f.name)}">
    <div class="fd">
      <div class="n">${esc(f.legalName)}</div>
      ${esc(f.address)}<br>${esc(f.city)}, ${esc(f.postcode)}<br>${esc(f.phone)}<br>${esc(f.email)}
    </div>
  </div>
  <div class="meta sans">
    <span class="pc">Private &amp; Confidential</span>
    <span>Date: <strong>${esc(d.dateStr)}</strong></span>
  </div>

  <h1>Contract for Services between</h1>
  <p class="parties"><strong>${esc(f.legalName.toUpperCase())}</strong>, ${esc(f.address)}, ${esc(f.city)} ${esc(f.postcode)} (‘The Accountants’) &amp;</p>
  <p class="parties"><strong>${esc(d.companyName.toUpperCase())}</strong>${d.clientAddress ? `, ${esc(d.clientAddress)}` : ''}${d.companyNumber ? ` (Company No. ${esc(d.companyNumber)})` : ''} (‘The Client’)</p>
  <p class="integral">This Fee Structure and quotation is an integral part of the engagement letter.</p>

  ${chBox}

  <table class="fees sans">
    <thead>
      <tr><th>Fees</th><th style="width:78px;text-align:right">Monthly £</th><th style="width:92px;text-align:right">Fees Upfront £</th><th style="width:110px;text-align:right">Annual Equivalent £</th><th style="width:96px">Payment Mode</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Fees Agreed</strong></td><td class="r"><strong>${gbp(totalMonthly)}</strong></td><td class="r">—</td><td class="r">${gbp(totalMonthly * 12)}</td><td>Monthly DD</td></tr>
      ${monthlyRows}
      ${oneoffHeader}
      ${oneoffRows}
      <tr class="total"><td>Final Monthly and One off Fees Agreed</td><td class="r">${gbp(totalMonthly)}</td><td class="r">${gbp(totalOneoff)}</td><td class="r">${gbp(totalMonthly * 12)}</td><td style="font-size:10.5px">Monthly DD<br>One off Upfront</td></tr>
    </tbody>
  </table>
  <p class="vatnote sans">Note: 20% VAT applies to all above</p>

  <div class="dd sans">
    <div class="t">Direct Debit — GoCardless Mandate</div>
    <p style="text-align:left">The Client's fees are collected by GoCardless Direct Debit. By signing this contract the Client authorises
    ${esc(f.name)} to collect fees using GoCardless direct debit and authorises the use of the bank details provided at
    signing for direct debit setup on the Client's behalf. Payments are protected by the Direct Debit Guarantee.</p>
  </div>

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

  <p style="font-weight:bold;margin-bottom:2px">The directors</p>
  <p style="font-weight:bold">${esc(d.companyName)}</p>
  <p>Dear Sir/s</p>
  <p>We are pleased to accept the instruction to act as accountant for your company and are writing to confirm the terms of our appointment.</p>
  <p>The purpose of this letter, together with the attached terms and conditions, is to set out our terms for carrying out the work and to clarify our respective responsibilities.</p>
  <p>We are bound by the ethical guidelines of ${esc(f.regBody)} and accept instructions to act for you on the basis that we will act in accordance with those ethical guidelines. A copy of these guidelines can be viewed at our offices on request${f.regBody === 'ACCA' ? ' or at www.accaglobal.com' : ''}.</p>

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
  <p>In regard to our professional obligations we are a member firm of the ${esc(f.regBody)}. Under the ethical and regulatory rules of ${esc(f.regBody)}, we are required to allow access to client files and records for the purpose of maintaining our membership of this body.</p>
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
    <img src="${base}${f.signatureImg}" alt="">
    <div class="n">${esc(partner)}</div>
    <div class="r">For and on behalf of, ${esc(f.legalName)}</div>
  </div>
  <p>I/We confirm that I/we have read and understood the contents of this letter and related terms and conditions and agree that it accurately reflects my/our fair understanding of the services that I/we require you to undertake.</p>

  <hr class="divider">

  <h1 style="letter-spacing:1px">SCHEDULE OF SERVICES</h1>
  <p>This schedule should be read in conjunction with the engagement letter and the terms and conditions of business.</p>
  <p style="font-weight:bold">PREPARATION OF STATUTORY FINANCIAL STATEMENTS IN COMPLIANCE WITH THE COMPANIES ACT 2006</p>
  <h3>1.0 Responsibilities and scope for financial statements preparation services</h3>
  <h3>1.1 Your responsibilities as directors</h3>
  <p>1.1.1 As directors of the company, you are responsible for preparing financial statements which give a true and fair view and which have been prepared in accordance with the Companies Act 2006 (the Act). As directors you must not approve the financial statements unless you are satisfied that they give a true and fair view of the assets, liabilities, financial position and profit or loss of the company.</p>
  <p>1.1.2 In preparing the financial statements, you are required to:</p>
  <ul>
    <li>select suitable accounting policies and then apply them consistently;</li>
    <li>make judgements and estimates that are reasonable and prudent; and</li>
    <li>prepare the financial statements on the going concern basis unless it is inappropriate to presume that the company will continue in business.</li>
  </ul>
  <p>1.1.3 You are responsible for keeping adequate accounting records that set out with reasonable accuracy at any time the company's financial position, and for ensuring that the financial statements comply with United Kingdom Accounting Standards (UK GAAP) and with the Companies Act 2006 and give a true and fair view.</p>
  <p>1.1.4 You are also responsible for safeguarding the assets of the company and hence for taking reasonable steps to prevent and detect fraud and other irregularities.</p>
  <p>1.1.5 You are also responsible for deciding whether, in each financial year, the company meets the conditions for exemption from an audit, as set out in section 477 or 480 of the Companies Act 2006, and for deciding whether the exemption cannot be claimed that year.</p>
  <p>1.1.6 You are responsible for ensuring that the company complies with laws and regulations that apply to its activities, and for preventing non-compliance and detecting any that occurs.</p>
  <p>1.1.7 You have undertaken to make available to us, as and when required, all the company's accounting records and related financial information, including minutes of management and members' meetings that we need to do our work.</p>
  <p>1.1.8 If financial information is published, which includes a report by us or is otherwise connected to us, on the company's website or by other electronic means, you must inform us of the electronic publication and get our consent before it occurs and ensure that it presents the financial information and report properly. We have the right to withhold consent to the electronic publication of our report or the financial statements if they are to be published in an inappropriate manner.</p>
  <p>1.1.9 You must set up controls to prevent or detect quickly any changes to electronically published information. We are not responsible for reviewing these controls nor for keeping the information under review after it is first published. You are responsible for the maintenance and integrity of electronically published information, and we accept no responsibility for changes made to any information after it is first posted.</p>
  <h3>1.2 Our responsibilities as accountants</h3>
  <p>1.2.1 You have asked us to help you prepare the financial statements in accordance with the requirements of the Companies Act 2006, to enable profits to be calculated to meet the requirements of current tax legislation and that provide sufficient and relevant information to complete a tax return. We will compile the financial statements for your approval based on the accounting records and the information and explanations that you give us.</p>
  <p>1.2.2 We shall plan our work on the basis that no report on the financial statements is required by statute or regulation for the year, unless you inform us in writing to the contrary. We will make enquiries of management and undertake any procedures that we judge appropriate but are under no obligation to perform procedures that may be required for assurance engagements such as audits or reviews.</p>
  <p>1.2.3 You have told us that the company is exempt from an audit of the financial statements. We will not check whether this is the case. However, if we find that the company is not entitled to the exemption, we will inform you of this.</p>
  <p>1.2.4 Our work will not be an audit of the financial statements in accordance with International Standards of Auditing (UK and Ireland). So we will not be able to provide any assurance that the accounting records or the financial statements are free from material misstatement, whether caused by fraud, other irregularities or error nor to identify weaknesses in internal controls.</p>
  <p>1.2.5 Since we will not carry out an audit, nor confirm in any way the accuracy or reasonableness of the accounting records, we cannot provide any assurance whether the financial statements that we prepare from those records will present a true and fair view.</p>
  <p>1.2.6 We will advise you on whether your records are adequate for preparation of the financial statements and recommend improvements.</p>
  <p>1.2.7 We have a professional duty to compile financial statements that conform with generally accepted accounting principles from the accounting records and information and explanations given to us. The accounting policies on which the financial statements have been compiled will be disclosed in an accounting policy and will be referred to in our accountants' report. We will not compile financial statements where the accounting principles, or the accounting policies selected by management are inappropriate.</p>
  <p>1.2.8 We also have a professional responsibility not to allow our name to be associated with financial statements which we believe may be misleading. Therefore, although we are not required to search for such matters, should we become aware, for any reason, that the financial statements may be misleading, we will discuss the matter with you with a view to agreeing appropriate adjustments and/or disclosures in the financial statements. In circumstances where adjustments and/or disclosures that we consider appropriate are not made or where we are not provided with appropriate information, and as a result we consider that the financial statements are misleading, we will withdraw from the engagement.</p>
  <p>1.2.9 As part of our normal procedures we may ask you to confirm in writing any information or explanations given to us orally during our work.</p>
  <h3>1.3 Form of the accountants' report</h3>
  <p>1.3.1 We will report to the Board of Directors, as appropriate, that in accordance with this engagement letter and to assist you to fulfil your responsibilities, we have not carried out an audit but have compiled the financial statements from the accounting records and from the information and explanations supplied to us. To the fullest extent permitted by law, we do not accept or assume responsibility to anyone other than the Company and the Company's Board of Directors, as a body, for our work or for this report.</p>

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
  </table>

  <div class="foot sans">${esc(f.regStatement)}</div>
</div>
</body>
</html>`;
}

/**
 * E-signature audit certificate — appended to the letter HTML when the client
 * signs, forming the tamper-evident signed copy (UK eIDAS / ECA 2000 / GDPR).
 */
export function buildAuditCertificate(a: AuditData): string {
  const signedAt = new Date(a.signedAtIso);
  const row = (k: string, v: string | null | undefined) =>
    v ? `<tr><td style="border:1px solid #c5cad3;padding:6px 10px;font-size:11px;font-weight:bold;background:#f8f9fb;width:220px">${esc(k)}</td><td style="border:1px solid #c5cad3;padding:6px 10px;font-size:11px;font-family:monospace">${esc(v)}</td></tr>` : '';

  return `
<div class="page" style="max-width:794px;margin:0 auto;padding:48px 64px;font-family:Arial,Helvetica,sans-serif;page-break-before:always">
  <div style="border:3px solid #16a34a;border-radius:6px;padding:20px 24px;margin-bottom:20px;background:#f0fdf4">
    <p style="margin:0;font-size:16px;font-weight:bold;color:#166534">✓ ELECTRONICALLY SIGNED</p>
    <p style="margin:6px 0 0;font-size:12px;color:#166534">This contract was executed by electronic signature. The audit record below forms part of the signed document.</p>
  </div>
  <h2 style="font-size:14px;margin:0 0 10px">Certificate of Electronic Signature</h2>
  <table style="width:100%;border-collapse:collapse">
    ${row('Signatory (typed signature)', a.signatureName)}
    ${row('Signatory email', a.signerEmail)}
    ${row('Signing on behalf of', `${a.companyName}${a.companyNumber ? ` (Company No. ${a.companyNumber})` : ''}`)}
    ${row('Date & time of signature (UTC)', signedAt.toISOString())}
    ${row('Date & time (UK)', signedAt.toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (Europe/London)')}
    ${row('Network (IP) address', a.ipAddress)}
    ${row('Browser / device', a.userAgent)}
    ${row('Document fingerprint (SHA-256)', a.documentSha256)}
    ${row('Contact preferences', (a.contactPrefs ?? []).join(', ') || undefined)}
    ${row('Direct Debit mandate', a.ddSummary ?? undefined)}
    ${row('Envelope reference', a.token ? a.token.substring(0, 16).toUpperCase() : undefined)}
  </table>
  <p style="font-size:10.5px;color:#6b7280;margin-top:14px;line-height:1.6">
    Legal notice: This document was signed electronically. Under the Electronic Communications Act 2000, the UK eIDAS
    Regulations (SI 2016/696, as amended) and the Law Commission's 2019 Statement on the Electronic Execution of
    Documents, an electronic signature is admissible in evidence and legally valid in England and Wales. The signatory
    confirmed their intention to be bound before signing. The document fingerprint above is the SHA-256 hash of the
    contract as presented at the point of signature; any alteration to the document after signing will produce a
    different fingerprint. Personal data in this certificate is processed for contract performance and legal compliance
    under UK GDPR Article 6(1)(b) and (c) and retained in accordance with the firm's data retention policy.
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
