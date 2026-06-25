/**
 * Engagement letter template (FR-DOC-2).
 * Rendered by Handlebars with the data context below.
 *
 * Template variables:
 *   entity.legalName, entity.address, entity.signatoryName
 *   client.name, client.companyNumber, client.type
 *   contact.name
 *   services           — array of { name, description }
 *   fees.total, fees.currency
 *   date               — ISO string
 *   reference          — case reference
 */
export const ENGAGEMENT_LETTER_TEMPLATE = `
<div class="letterhead">
  <p><strong>{{entity.legalName}}</strong></p>
  <p>{{entity.address}}</p>
</div>

<p style="margin-top:1.5em;">{{formatDate date}}</p>

<p style="margin-top:1.5em;">
  {{contact.name}}<br/>
  {{client.name}}
  {{#if client.companyNumber}}<br/>Company number: {{client.companyNumber}}{{/if}}
</p>

<h1 style="margin-top:2em;">Letter of Engagement</h1>

<p>Dear {{contact.name}},</p>

<p>
  We are pleased to confirm the terms of our engagement to provide services
  to <strong>{{client.name}}</strong>. Please read this letter carefully,
  together with our Terms and Conditions and Privacy Notice (enclosed).
</p>

<h2 style="font-size:12pt; margin-top:1.5em;">1. Scope of services</h2>
<p>We will provide the following services:</p>
<ul>
  {{#each services}}
  <li><strong>{{this.name}}</strong>{{#if this.description}} — {{this.description}}{{/if}}</li>
  {{/each}}
</ul>

<h2 style="font-size:12pt; margin-top:1.5em;">2. Fees</h2>
<p>
  Our agreed fees for the above services are
  <strong>{{fees.currency}} {{fees.total}}</strong> per annum
  (exclusive of VAT unless stated otherwise). Fees are reviewed annually.
</p>
<p>
  Invoices will be issued monthly / quarterly (as agreed) and are payable within 30 days.
  We reserve the right to charge interest on late payments at 8% above the Bank of England
  base rate in accordance with the Late Payment of Commercial Debts (Interest) Act 1998.
</p>

<h2 style="font-size:12pt; margin-top:1.5em;">3. Your responsibilities</h2>
<p>You agree to:</p>
<ul>
  <li>Provide complete, accurate and timely information and records.</li>
  <li>Notify us promptly of any changes in your circumstances that may affect our advice.</li>
  <li>Retain all records for the minimum period required by law.</li>
</ul>

<h2 style="font-size:12pt; margin-top:1.5em;">4. Regulatory and professional responsibilities</h2>
<p>
  {{entity.legalName}} is regulated by ICAEW/ACCA (as applicable). We are required under the Money
  Laundering Regulations 2017 to verify the identity of our clients and to report any suspicion of
  money laundering to the National Crime Agency. We cannot provide advice that conceals information
  from HMRC or other authorities.
</p>

<h2 style="font-size:12pt; margin-top:1.5em;">5. Limitation of liability</h2>
<p>
  Our liability is limited to direct losses and shall not exceed three times the fees paid in the
  preceding 12 months. Nothing in this letter limits liability for death, personal injury or fraud.
</p>

<h2 style="font-size:12pt; margin-top:1.5em;">6. Termination</h2>
<p>
  Either party may terminate this engagement by giving one month's written notice. Fees remain
  due for work completed up to the termination date.
</p>

<p style="margin-top:1.5em;">
  We look forward to working with you. If the above terms are acceptable please sign and return
  one copy of this letter.
</p>

<div class="signature-block">
  <p>Yours sincerely,</p>
  <p style="margin-top:2em;"><strong>{{entity.signatoryName}}</strong></p>
  <p>For and on behalf of {{entity.legalName}}</p>
</div>

<hr style="margin-top:2em;" />

<p style="font-size:9pt;"><strong>Client acceptance</strong></p>
<p style="font-size:9pt;">
  I/We accept the terms set out in this letter and confirm I/We have received the Terms and
  Conditions and Privacy Notice.
</p>
<p style="font-size:9pt;">
  Signature: _____________________________  &nbsp; Date: ___________________
</p>
<p style="font-size:9pt;">
  Name: _____________________________  &nbsp; Position: ___________________
</p>

<p style="font-size:8pt; color:#666; margin-top:1em;">Ref: {{reference}}</p>
`;
