import Handlebars from "handlebars";

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Onboarding Completion Report — {{client.name}}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; margin: 40px; }
  h1 { font-size: 20px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }
  h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; background: #f5f5f5; padding: 6px; border: 1px solid #ddd; }
  td { padding: 6px; border: 1px solid #ddd; }
  .badge-pass { color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  .badge-fail { color: #991b1b; background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  .badge-pending { color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
  footer { margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <strong>{{entity.legalName}}</strong><br/>
    {{entity.address}}<br/>
    {{#if entity.amlSupervisor}}<small>AML supervisor: {{entity.amlSupervisor}}</small>{{/if}}
  </div>
  <div style="text-align:right">
    <strong>Onboarding Completion Report</strong><br/>
    Date: {{report.generatedDate}}<br/>
    Ref: {{report.reference}}
  </div>
</div>

<h1>Client Onboarding Report</h1>

<h2>Client Details</h2>
<table>
  <tr><th style="width:35%">Field</th><th>Value</th></tr>
  <tr><td>Client name</td><td>{{client.name}}</td></tr>
  {{#if client.companyNumber}}<tr><td>Company number</td><td>{{client.companyNumber}}</td></tr>{{/if}}
  <tr><td>Client type</td><td>{{client.clientType}}</td></tr>
  <tr><td>Services agreed</td><td>{{client.services}}</td></tr>
  <tr><td>Onboarding started</td><td>{{case.startedAt}}</td></tr>
  <tr><td>Onboarding completed</td><td>{{case.completedAt}}</td></tr>
</table>

<h2>Identity & Compliance</h2>
<table>
  <tr><th>Check</th><th>Outcome</th><th>Date</th><th>Ref</th></tr>
  {{#each checks}}
  <tr>
    <td>{{label}}</td>
    <td><span class="badge-{{#if passed}}pass{{else}}{{#if pending}}pending{{else}}fail{{/if}}{{/if}}">
      {{#if passed}}PASS{{else}}{{#if pending}}PENDING{{else}}FAIL{{/if}}{{/if}}
    </span></td>
    <td>{{date}}</td>
    <td>{{ref}}</td>
  </tr>
  {{/each}}
</table>

<h2>Documents</h2>
<table>
  <tr><th>Document</th><th>Type</th><th>Status</th><th>Verified</th></tr>
  {{#each documents}}
  <tr>
    <td>{{name}}</td>
    <td>{{type}}</td>
    <td>{{status}}</td>
    <td>{{#if verified}}Yes{{else}}—{{/if}}</td>
  </tr>
  {{/each}}
</table>

<h2>Professional Clearance</h2>
{{#if clearance.notRequired}}
<p>Professional clearance not required for this client.</p>
{{else}}
<table>
  <tr><th style="width:35%">Field</th><th>Value</th></tr>
  <tr><td>Previous firm</td><td>{{clearance.prevFirmName}}</td></tr>
  <tr><td>Clearance status</td><td>{{clearance.status}}</td></tr>
  <tr><td>Outcome</td><td>{{clearance.outcome}}</td></tr>
  <tr><td>Date received</td><td>{{clearance.receivedAt}}</td></tr>
</table>
{{/if}}

<h2>Authorisation & Engagement</h2>
<table>
  <tr><th>Document</th><th>Sent</th><th>Signed</th><th>Signed by</th></tr>
  {{#each esignDocs}}
  <tr>
    <td>{{name}}</td>
    <td>{{sentAt}}</td>
    <td>{{#if signedAt}}{{signedAt}}{{else}}—{{/if}}</td>
    <td>{{#if signedBy}}{{signedBy}}{{else}}—{{/if}}</td>
  </tr>
  {{/each}}
</table>

<h2>Risk Assessment Summary</h2>
<table>
  <tr><th style="width:35%">Field</th><th>Value</th></tr>
  <tr><td>Overall risk rating</td><td>{{risk.rating}}</td></tr>
  <tr><td>Assessed by</td><td>{{risk.assessedBy}}</td></tr>
  <tr><td>Assessment date</td><td>{{risk.assessedAt}}</td></tr>
  {{#if risk.reviewDate}}<tr><td>Next review due</td><td>{{risk.reviewDate}}</td></tr>{{/if}}
</table>

{{#if reviews.length}}
<h2>Ledger Reviews</h2>
<table>
  <tr><th>Review type</th><th>Period</th><th>Status</th><th>Findings</th><th>Signed off</th></tr>
  {{#each reviews}}
  <tr>
    <td>{{reviewType}}</td>
    <td>{{period}}</td>
    <td>{{status}}</td>
    <td>{{findingCount}}</td>
    <td>{{#if signedOffAt}}{{signedOffAt}}{{else}}—{{/if}}</td>
  </tr>
  {{/each}}
</table>
{{/if}}

<footer>
  This report was generated automatically by {{entity.legalName}} on {{report.generatedDate}}.
  Retained in accordance with ICAEW/HMRC 6-year retention requirements.
  Report reference: {{report.reference}}
</footer>
</body>
</html>`;

const compiled = Handlebars.compile(TEMPLATE);

export interface CompletionReportData {
  entity: {
    legalName: string;
    address: string;
    amlSupervisor?: string;
  };
  client: {
    name: string;
    companyNumber?: string;
    clientType: string;
    services: string;
  };
  case: {
    startedAt: string;
    completedAt: string;
  };
  checks: Array<{
    label: string;
    passed: boolean;
    pending: boolean;
    date: string;
    ref: string;
  }>;
  documents: Array<{
    name: string;
    type: string;
    status: string;
    verified: boolean;
  }>;
  clearance: {
    notRequired: boolean;
    prevFirmName?: string;
    status?: string;
    outcome?: string;
    receivedAt?: string;
  };
  esignDocs: Array<{
    name: string;
    sentAt: string;
    signedAt?: string;
    signedBy?: string;
  }>;
  risk: {
    rating: string;
    assessedBy: string;
    assessedAt: string;
    reviewDate?: string;
  };
  reviews: Array<{
    reviewType: string;
    period: string;
    status: string;
    findingCount: number;
    signedOffAt?: string;
  }>;
  report: {
    generatedDate: string;
    reference: string;
  };
}

export function renderCompletionReport(data: CompletionReportData): string {
  return compiled(data);
}
