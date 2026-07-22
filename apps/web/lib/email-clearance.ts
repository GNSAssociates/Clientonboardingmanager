/**
 * Professional clearance email templates — initial request and follow-up chase.
 * These are sent to the previous accountant.
 */
import type { FirmConfig } from './firms';
import type { DocItem } from '@/app/(staff)/staff/cases/[id]/clearance/_tracker';

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Firm logo as an absolute URL (emails need absolute src). Empty string when
// the app URL isn't configured so we never embed a broken image.
export function logoImg(firm: FirmConfig): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || appUrl.startsWith("http://localhost")) return "";
  return `<img src="${appUrl}${firm.logo}" alt="${firm.name}" height="52" style="display:block;margin-bottom:16px">`;
}

function shell(accentColor: string, body: string, footer: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${accentColor},#1e3a8a);font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:32px 36px">${body}</td></tr>
  <tr><td style="padding:16px 36px 24px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#9ca3af">${footer}</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function docTable(items: Array<{ label: string; year: string }>) {
  const grouped: Record<string, string[]> = {};
  for (const i of items) {
    if (!grouped[i.label]) grouped[i.label] = [];
    grouped[i.label]!.push(i.year);
  }
  const rows = Object.entries(grouped).map(([label, years]) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;font-weight:600">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">${years.join(', ')}</td>
    </tr>`
  ).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
    <thead><tr style="background:#f9fafb">
      <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Document</th>
      <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Year(s)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── Initial clearance request ─────────────────────────────────────────────────

interface ClearanceRequestEmailData {
  firm: FirmConfig;
  clientName: string;
  companyNumber: string;
  directorName?: string;
  prevFirmName: string;
  prevFirmAddress?: string;
  clearanceUrl: string;
  today: string;
  deadline: number;
  docItems: Array<{ label: string; year: string; type: string }>;
}

export function buildClearanceRequestEmail(d: ClearanceRequestEmailData): string {
  const relevantItems = d.docItems.filter(i => i.year !== 'All');
  const refsItem = d.docItems.find(i => i.type === 'REFS');

  const body = `
${logoImg(d.firm)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
  <tr>
    <td><p style="margin:0;font-size:18px;font-weight:700;color:#111">${d.firm.legalName}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${d.firm.address}, ${d.firm.city}, ${d.firm.postcode}</p>
    <p style="margin:1px 0 0;font-size:12px;color:#6b7280">${d.firm.email} · ${d.firm.phone}</p></td>
    <td align="right" valign="top"><p style="margin:0;font-size:12px;color:#9ca3af">${d.today}</p>
    <p style="margin:2px 0 0;font-size:11px;color:#9ca3af">PRIVATE &amp; CONFIDENTIAL</p></td>
  </tr>
</table>
<div style="height:1px;background:#e5e7eb;margin-bottom:20px"></div>

<div style="background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px">
  Private &amp; Confidential
</div>

${d.prevFirmAddress
  ? `<p style="margin:0 0 16px;font-size:13px;color:#374151"><strong>${d.prevFirmName}</strong><br>${d.prevFirmAddress}</p>`
  : `<p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151">${d.prevFirmName}</p>`}

<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111">
  Re: ${d.directorName ? `${d.directorName} and ` : ''}${d.clientName.toUpperCase()}${d.companyNumber ? ` — Company No. ${d.companyNumber}` : ''}
</p>

<p style="margin:0 0 14px;font-size:14px;color:#374151">Dear Sirs,</p>

<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
  We have been requested to act as accountants for the above (individuals and Company). In connection to this,
  we are writing to you to enquire if there are any professional reasons why we should not act for the company
  and its director.
</p>

<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
  Assuming that there are no such matters, we request you to provide us with the following information
  (whichever are relevant):
</p>

<ol style="margin:0 0 20px;padding-left:24px">
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Bookkeeping files/working files</strong> for current tax year for the company</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Previous year P&amp;L and balance sheet</strong> ledgers with detailed breakdown</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Current Year's YTD Trial Balance</strong> with closing date up until bookkeeping completion</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Detailed P&amp;L and Balance Sheet</strong> for last 2 tax years (including schedules, capital allowances, director's loan account, s455 tax details)</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Director's personal tax returns</strong> for last 2 years, plus P60s/P45s for years not yet filed</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Online access information:</strong>
    <ul style="margin:6px 0 0;padding-left:24px">
      <li style="font-size:13px;color:#374151;margin-bottom:4px">MTD Compatible software access — please send an invite to <strong>${d.firm.mtdEmail}</strong></li>
      <li style="font-size:13px;color:#374151;margin-bottom:4px">HMRC and Companies House login credentials (if created for the client)</li>
      ${d.firm.nestDelegateId ? `<li style="font-size:13px;color:#374151">NEST Pension — Organisation Name: <strong>${d.firm.nestOrgName}</strong>, Delegate Organisation ID: <strong>${d.firm.nestDelegateId}</strong></li>` : `<li style="font-size:13px;color:#374151">NEST Pension login credentials (if applicable)</li>`}
    </ul>
  </li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Tax reference numbers:</strong> Company UTR, Companies House Authentication Code, VAT Certificate (Box 5 figure), PAYE Reference, Accounts Office Reference, Director's UTR &amp; NI Number</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>Payroll RTI &amp; Pensions:</strong> Current year payroll till last RTI filing, last 2 years P60s/P45s, staff details, pension information</li>
  <li style="font-size:13px;color:#374151;margin-bottom:10px;line-height:1.6"><strong>VAT returns</strong> for last four quarters (if MTD access not provided), plus any HMRC correspondence and outstanding matters</li>
</ol>

<p style="margin:16px 0 20px;font-size:14px;color:#374151;line-height:1.7">
  Please use the secure button below to confirm your response and indicate how records will be transferred.
  Alternatively, reply directly to this email. Please respond within <strong>${d.deadline} days</strong>.
</p>

<div style="text-align:center;margin:24px 0">
  <a href="${d.clearanceUrl}" style="display:inline-block;background:${d.firm.accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">
    Respond to Clearance Request
  </a>
</div>

<p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
  If we do not receive a response within ${d.deadline} days, we will assume there are no matters to bring to our attention.
  Automated follow-up reminders will be sent every 5 days for any outstanding items.
</p>

<p style="margin:16px 0 0;font-size:14px;color:#374151;line-height:1.7">
  Thank you for your assistance in this matter for a smooth changeover.
</p>

<p style="margin:24px 0 0;font-size:14px;color:#374151">
  Kind Regards,<br>
  <strong>${d.firm.partnerName}</strong><br>
  <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle}</span><br>
  <span style="color:#6b7280;font-size:13px">${d.firm.legalName}</span>
</p>`;

  return shell(d.firm.accentColor, body,
    `${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}`);
}

// ─── Chase / follow-up email ──────────────────────────────────────────────────

interface ClearanceChaseEmailData {
  firm: FirmConfig;
  prevFirmName: string;
  chaseNumber: number;
  outstanding: DocItem[];
  received?: DocItem[];
  clearanceUrl: string;
  today: string;
}

export function buildClearanceChaseEmail(d: ClearanceChaseEmailData): string {
  const itemRows = d.outstanding.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;font-size:13px;color:#374151;font-weight:600">${i.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;font-size:13px;color:#6b7280">${i.year}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fef3c7;font-size:12px;color:#d97706;font-weight:600">Outstanding</td>
    </tr>`
  ).join('');

  // A clear "already received" section so the previous accountant sees exactly
  // what is still remaining versus what we have acknowledged receiving.
  const received = d.received ?? [];
  const receivedBlock = received.length ? `
<p style="margin:0 0 10px;font-size:13px;color:#374151">For your reference, we confirm we have already received the following (thank you):</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d1fae5;border-radius:8px;overflow:hidden;margin:0 0 20px">
  <thead><tr style="background:#ecfdf5">
    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#065f46;font-weight:600">Document</th>
    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#065f46;font-weight:600">Received on</th>
  </tr></thead>
  <tbody>${received.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #d1fae5;font-size:13px;color:#374151">${i.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #d1fae5;font-size:13px;color:#059669">${i.receivedDate ? new Date(i.receivedDate).toLocaleDateString('en-GB') : 'Received'}</td></tr>`
  ).join('')}</tbody>
</table>` : '';

  const body = `
${logoImg(d.firm)}
<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111">${d.firm.legalName}</p>
<p style="margin:0 0 20px;font-size:12px;color:#9ca3af">${d.today}</p>
<div style="height:1px;background:#e5e7eb;margin-bottom:20px"></div>

<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:20px">
  <p style="margin:0;font-size:13px;font-weight:700;color:#92400e">Follow-up Notice ${d.chaseNumber}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#78350f">This is a reminder that the following documents remain outstanding.</p>
</div>

<p style="margin:0 0 14px;font-size:14px;color:#374151">Dear ${d.prevFirmName},</p>
<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
  We refer to our earlier professional clearance request and note that the following documents are still outstanding:
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fcd34d;border-radius:8px;overflow:hidden;margin:0 0 20px">
  <thead><tr style="background:#fffbeb">
    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#92400e;font-weight:600">Document</th>
    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#92400e;font-weight:600">Year</th>
    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#92400e;font-weight:600">Status</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

${receivedBlock}

<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
  We would be grateful if you could arrange to send the outstanding items above at your earliest convenience.
  Please use the button below to respond or contact us directly.
</p>

<div style="text-align:center;margin:20px 0">
  <a href="${d.clearanceUrl}" style="display:inline-block;background:${d.firm.accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">
    Respond to Clearance Request
  </a>
</div>

<p style="margin:20px 0 0;font-size:14px;color:#374151">
  Yours faithfully,<br>
  <strong>${d.firm.partnerName}</strong><br>
  <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle} · ${d.firm.legalName}</span>
</p>`;

  return shell(d.firm.accentColor, body,
    `${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}`);
}
