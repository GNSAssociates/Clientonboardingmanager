/**
 * Authority-to-Act letter template (FR-DOC-1).
 * Rendered by Handlebars with the data context below.
 *
 * Template variables:
 *   entity.legalName, entity.address, entity.signatoryName
 *   client.name, client.companyNumber, client.type
 *   contact.name, contact.email
 *   date              — ISO string (formatted by {{formatDate}})
 *   reference         — case reference
 */
export const AUTH_LETTER_TEMPLATE = `
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

<h1 style="margin-top:2em;">Authority to Act as Accountants</h1>

<p>Dear {{contact.name}},</p>

<p>
  We write to confirm that <strong>{{entity.legalName}}</strong> will act as
  accountants and tax advisers to <strong>{{client.name}}</strong>
  {{#if client.companyNumber}}(Company No. {{client.companyNumber}}){{/if}}
  with effect from {{formatDate date}}.
</p>

<p>
  By signing this letter you authorise us to:
</p>
<ul>
  <li>Act on your behalf in all matters relating to accountancy, taxation, and associated services as agreed.</li>
  <li>Correspond with HMRC on your behalf.</li>
  <li>File statutory accounts and returns as required.</li>
  <li>Receive information from your previous advisers relevant to the above.</li>
</ul>

<p>
  This authority is given until further written notice. A copy of our full Terms of Business and our Privacy
  Notice are enclosed for your information.
</p>

<p>Please sign and return one copy of this letter to confirm your agreement.</p>

<div class="signature-block">
  <p>Yours sincerely,</p>
  <p style="margin-top:2em;"><strong>{{entity.signatoryName}}</strong></p>
  <p>For and on behalf of {{entity.legalName}}</p>
</div>

<hr style="margin-top:2em;" />

<p style="font-size:9pt;"><strong>Client acknowledgement</strong></p>
<p style="font-size:9pt;">
  I/We agree to the above authority and confirm I/We have received a copy of the Terms of Business.
</p>
<p style="font-size:9pt;">
  Signature: _____________________________  &nbsp; Date: ___________________
</p>
<p style="font-size:9pt;">
  Name: _____________________________  &nbsp; Position: ___________________
</p>

<p style="font-size:8pt; color:#666; margin-top:1em;">Ref: {{reference}}</p>
`;
