/**
 * All transactional email templates for GNS Associates onboarding platform.
 * Based on real GNS engagement letter format and professional clearance letter (LLP).
 * Each function returns a complete HTML string ready to pass to sendMail().
 */

import type { FirmConfig } from './firms';
import { fmtGBP } from './format';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function emailShell(accentColor: string, content: string, footerText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${accentColor},#1e3a8a);font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:0">${content}</td></tr>
  <tr><td style="padding:20px 36px 28px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6">${footerText}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// Firm logo as an absolute URL — skipped when the app URL isn't configured
function logoTag(firm: FirmConfig): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || appUrl.startsWith('http://localhost')) return '';
  return `<img src="${appUrl}${firm.logo}" alt="${firm.name}" height="52" style="display:block;margin-bottom:14px">`;
}

function letterhead(firm: FirmConfig, dateStr: string): string {
  return `
<div style="padding:28px 36px 0">
  ${logoTag(firm)}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <p style="margin:0;font-size:18px;font-weight:700;color:#111">${firm.legalName}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${firm.address}, ${firm.city}, ${firm.postcode}</p>
        <p style="margin:1px 0 0;font-size:12px;color:#6b7280">${firm.email} · ${firm.phone}</p>
      </td>
      <td align="right" valign="top">
        <p style="margin:0;font-size:12px;color:#9ca3af">${dateStr}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#9ca3af">PRIVATE &amp; CONFIDENTIAL</p>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:#e5e7eb;margin:20px 0 0"></div>
</div>`;
}

function serviceTable(services: Array<{ name: string; price: number }>): string {
  const rows = services.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151">${s.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;white-space:nowrap">${fmtGBP(s.price)}/month</td>
    </tr>`).join('');
  const total = services.reduce((s, sv) => s + sv.price, 0);
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
  <thead>
    <tr style="background:#f9fafb">
      <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Service</th>
      <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Monthly Fee (+ VAT)</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr style="background:#f0f4ff">
      <td style="padding:10px 12px;font-weight:700;font-size:13px;color:#1e3a8a">Total Monthly</td>
      <td style="padding:10px 12px;font-weight:700;font-size:14px;color:#1e3a8a;text-align:right">${fmtGBP(total)}/month + VAT</td>
    </tr>
  </tfoot>
</table>`;
}

function actionButton(url: string, label: string, color: string): string {
  return `
<div style="text-align:center;margin:28px 0">
  <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,${color},#1e3a8a);color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(0,0,0,0.18)">
    ${label} →
  </a>
</div>
<p style="text-align:center;font-size:11px;color:#9ca3af;margin:-12px 0 0">Or copy this link: <a href="${url}" style="color:${color};word-break:break-all">${url}</a></p>`;
}

// ─── 1. Engagement Letter Email — sent to director when link is created ──────

interface EngagementEmailData {
  firm: FirmConfig;
  companyName: string;
  companyNumber: string;
  directorName: string;
  services: Array<{ name: string; price: number }>;
  engagementUrl: string;
  expiresAt: string;
  today: string;
  proposal?: boolean;      // frame the covering note as a proposal
  proposalOnly?: boolean;  // proposal for approval only — no signing yet
}

export function buildEngagementLetterEmail(d: EngagementEmailData): string {
  const total = d.services.reduce((s, sv) => s + sv.price, 0);
  const intro = d.proposalOnly
    ? `We are grateful for your interest in our services and are pleased to present our proposal for <strong>${d.companyName}</strong> (Company No. ${d.companyNumber}). Below is a summary of the services and fees we discussed. Please review the proposal and, if you are happy to proceed, approve it — we will then send your engagement letter to formalise the appointment.`
    : d.proposal
    ? `We are grateful for your interest in our services and are pleased to present our proposal for <strong>${d.companyName}</strong> (Company No. ${d.companyNumber}). Below is a summary of the services and fees we discussed, together with your engagement letter. Approving the proposal and signing the engagement letter is the first step of our professional journey together.`
    : `We are pleased to confirm that <strong>${d.firm.legalName}</strong> would like to act as accountants for <strong>${d.companyName}</strong> (Company No. ${d.companyNumber}). Please find below a summary of the agreed services and fees, together with your engagement letter to review and sign.`;
  const cta = d.proposalOnly
    ? `Please click the button below to review the full proposal and approve it. <strong>This link expires in 30 days (${d.expiresAt}).</strong>`
    : `Please click the button below to read your full engagement letter, provide your previous accountant details, and sign the declaration. <strong>This link expires in 30 days (${d.expiresAt}).</strong>`;
  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <p style="margin:0 0 16px;font-size:15px;color:#374151">Dear ${d.directorName || 'Director'},</p>
  <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7">${intro}</p>
  ${serviceTable(d.services)}
  <p style="margin:16px 0;font-size:13px;color:#6b7280">
    Annual equivalent: <strong>${fmtGBP(total * 12)} + VAT</strong>${d.proposalOnly ? '' : ' · Payment by GoCardless Direct Debit'}.
    <br><strong>Note: 20% VAT applies to all fees above.</strong>
  </p>
  <p style="margin:0 0 8px;font-size:14px;color:#374151">${cta}</p>
  ${actionButton(d.engagementUrl, d.proposalOnly ? 'Review &amp; Approve Proposal' : 'Review &amp; Sign Engagement Letter', d.firm.accentColor)}
  <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
    If you have any questions before signing, please contact us at
    <a href="mailto:${d.firm.email}" style="color:${d.firm.accentColor}">${d.firm.email}</a> or call ${d.firm.phone}.
  </p>
  <p style="margin:24px 0 0;font-size:14px;color:#374151">
    Yours sincerely,<br>
    <strong>${d.firm.partnerName}</strong><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle}</span><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.legalName}</span>
  </p>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}`);
}

// ─── 2. Professional Clearance Email — sent to previous accountant ────────────

interface ClearanceEmailData {
  firm: FirmConfig;
  companyName: string;
  companyNumber: string;
  directorName: string;
  prevFirmName: string;
  prevFirmAddress?: string;
  clearanceUrl: string;
  today: string;
}

export function buildProfessionalClearanceEmail(d: ClearanceEmailData): string {
  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:8px 14px;margin-bottom:20px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px">
    Private &amp; Confidential
  </div>

  ${d.prevFirmAddress ? `<p style="margin:0 0 16px;font-size:13px;color:#374151;white-space:pre-line">${d.prevFirmName}\n${d.prevFirmAddress}</p>` : `<p style="margin:0 0 16px;font-size:13px;color:#374151"><strong>${d.prevFirmName}</strong></p>`}

  <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111">
    Re: ${d.companyName} — Company No. ${d.companyNumber}${d.directorName ? ` / ${d.directorName}` : ''}
  </p>

  <p style="margin:0 0 16px;font-size:14px;color:#374151">Dear Sirs,</p>

  <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
    We have been requested to act as accountants for the above company and its director(s). In connection with this,
    we are writing to enquire if there are any professional reasons why we should not act for the company and its directors.
  </p>
  <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
    Assuming there are no such matters, we request you to provide us with the following information (whichever are relevant):
  </p>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
    ${[
      ['Accounting Records', [
        'Copies of the bookkeeping files / working files for the current tax year for the company',
        'Previous year profit and loss and balance sheet ledgers — detailed breakdown',
        'Current Year YTD Trial Balance with closing date up until bookkeeping is completed',
        'Detailed P&amp;L and Balance Sheet, schedules, capital allowances record, director\'s loan account, and details of s455 tax (if relevant) for the last 2 tax years filed with HMRC and Companies House',
      ]],
      ['Director\'s Personal Tax', [
        'Copies of director\'s last 2 years personal tax returns',
        'Copies of P60s / P45s relevant for the director\'s tax return not yet filed',
      ]],
      ['Online Access Information', [
        `MTD Compatible Software — please send an invite to <strong>${d.firm.mtdEmail}</strong>`,
        'HMRC and Companies House login credentials (if created for the client)',
        `NEST Pension — please use:<br>Organisation Name: <strong>${d.firm.nestOrgName}</strong><br>Delegate Organisation ID: <strong>${d.firm.nestDelegateId}</strong>`,
      ]],
      ['Tax Reference Numbers / Codes', [
        'Company UTR (Unique Taxpayer Reference)',
        'Companies House Authentication Code',
        'VAT Certificate and confirmation of Box 5 figure from the last filed VAT return',
        'PAYE Reference and Accounts Office Reference Number',
        'Director\'s UTR and National Insurance Number',
      ]],
      ['Payroll RTI &amp; Pensions', [
        'Running / Current Year Payroll to last filed RTI period showing: Gross, Tax, NI, Employer NI, and Pension (Staff Details / P11 Deductions and RTI filings)',
        'Copies of previous 2 years P60s / P45s and complete Payroll Report showing Gross, Tax, NI, Employer NI, and Pension',
        'Details of any statutory payments made to employees (SSP / SMP)',
      ]],
      ['VAT Returns', [
        'Last 4 quarters of VAT returns submitted, with detailed breakdown of Input and Output VAT and respective Net figures (if MTD software access has not been provided)',
      ]],
      ['HMRC Correspondence', [
        'Copies of any recent correspondence with HM Revenue &amp; Customs and details of any outstanding matters',
      ]],
    ].map(([section, items]) => `
    <tr>
      <td style="padding:0 0 16px">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#${d.firm.accentColor.replace('#', '')};text-transform:uppercase;letter-spacing:0.4px">${section}</p>
        <ul style="margin:0;padding-left:20px">
          ${(items as string[]).map(item => `<li style="margin:0 0 6px;font-size:13px;color:#4b5563;line-height:1.6">${item}</li>`).join('')}
        </ul>
      </td>
    </tr>`).join('')}
  </table>

  <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
    Please use the secure button below to confirm your response, note any outstanding fees, and confirm how you will
    transfer the records. If you prefer to respond by email, please reply directly to this message.
  </p>

  ${actionButton(d.clearanceUrl, 'Respond to Clearance Request', d.firm.accentColor)}

  <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
    Please respond within <strong>14 days</strong>. If we do not hear from you we will assume there are no matters
    to bring to our attention. Thank you for your assistance in this matter for a smooth changeover.
  </p>

  <p style="margin:24px 0 0;font-size:14px;color:#374151">
    Yours faithfully,<br>
    <strong>${d.firm.partnerName}</strong><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle}</span><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.legalName}</span>
  </p>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}`);
}

// ─── 3. Client Follow-Up — reminder to sign engagement letter ─────────────────

interface ClientFollowUpData {
  firm: FirmConfig;
  companyName: string;
  directorName: string;
  engagementUrl: string;
  expiresAt: string;
  followUpNumber: number;
  today: string;
}

export function buildClientFollowUpEmail(d: ClientFollowUpData): string {
  const urgency = d.followUpNumber === 1
    ? 'We wanted to follow up on your engagement letter — please take a few minutes to review and sign.'
    : d.followUpNumber === 2
    ? 'This is a second reminder regarding your engagement letter. Please sign at your earliest convenience to avoid any delay in your accounting services.'
    : 'This is an urgent final reminder. Your engagement link expires soon. Please sign immediately to avoid it expiring.';

  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <p style="margin:0 0 16px;font-size:15px;color:#374151">Dear ${d.directorName || 'Director'},</p>
  <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7">
    ${urgency}
  </p>
  <div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
    <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">
      ⏰ Your engagement link for <strong>${d.companyName}</strong> expires on <strong>${d.expiresAt}</strong>.
    </p>
  </div>
  <p style="margin:0 0 8px;font-size:14px;color:#374151">
    Simply click the button below to review your engagement letter and complete your sign-up:
  </p>
  ${actionButton(d.engagementUrl, 'Sign Engagement Letter Now', d.firm.accentColor)}
  <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
    If you have any questions or would prefer to discuss by phone, please contact us at
    <a href="mailto:${d.firm.email}" style="color:${d.firm.accentColor}">${d.firm.email}</a> or call ${d.firm.phone}.
  </p>
  <p style="margin:24px 0 0;font-size:14px;color:#374151">
    Yours sincerely,<br>
    <strong>${d.firm.partnerName}</strong><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle} · ${d.firm.legalName}</span>
  </p>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `${d.firm.legalName} · ${d.firm.regStatement}`);
}

// ─── 4. Previous Accountant Follow-Up — reminder to respond to clearance ──────

interface PrevAccountantFollowUpData {
  firm: FirmConfig;
  prevFirmName: string;
  companyName: string;
  companyNumber: string;
  clearanceUrl: string;
  followUpNumber: number;
  requestedAt: string;
  today: string;
}

export function buildPrevAccountantFollowUpEmail(d: PrevAccountantFollowUpData): string {
  const urgency = d.followUpNumber === 1
    ? `This is a follow-up to our professional clearance request of ${d.requestedAt}. We have not yet received your response.`
    : d.followUpNumber === 2
    ? `This is our second follow-up regarding our professional clearance request for ${d.companyName} dated ${d.requestedAt}. We would be grateful for your response at your earliest convenience.`
    : `This is our final follow-up regarding our professional clearance request for ${d.companyName}. If we do not receive a response we will proceed on the basis that there are no matters to bring to our attention.`;

  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111">
    Re: Professional Clearance — ${d.companyName} (Company No. ${d.companyNumber})
  </p>
  <p style="margin:0 0 16px;font-size:14px;color:#374151">Dear Sirs,</p>
  <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7">${urgency}</p>
  <p style="margin:0 0 8px;font-size:14px;color:#374151">
    To confirm clearance and arrange record transfer, please use the secure link below:
  </p>
  ${actionButton(d.clearanceUrl, 'Respond to Clearance Request', d.firm.accentColor)}
  <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
    If you prefer to respond by email, please reply directly to this message at
    <a href="mailto:${d.firm.email}" style="color:${d.firm.accentColor}">${d.firm.email}</a>.
    <br>We appreciate your assistance in ensuring a smooth transition for the client.
  </p>
  <p style="margin:24px 0 0;font-size:14px;color:#374151">
    Yours faithfully,<br>
    <strong>${d.firm.partnerName}</strong><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle} · ${d.firm.legalName}</span>
  </p>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}`);
}

// ─── 5. Firm Notification — new client signed ─────────────────────────────────

interface FirmNotificationData {
  firm: FirmConfig;
  companyName: string;
  companyNumber: string;
  directorName: string;
  clientEmail: string;
  services: Array<{ name: string; price: number }>;
  prevFirmName?: string;
  prevEmail?: string;
  noPrevAccountant: boolean;
  today: string;
}

export function buildFirmNewClientEmail(d: FirmNotificationData): string {
  const total = d.services.reduce((s, sv) => s + sv.price, 0);
  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin-bottom:20px">
    <p style="margin:0;font-size:15px;font-weight:700;color:#166534">✅ New Client Onboarded — ${d.companyName}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#4ade80">Engagement letter signed · ${d.today}</p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
    ${[
      ['Company', `${d.companyName} (CH: ${d.companyNumber})`],
      ['Director', d.directorName || '—'],
      ['Contact Email', d.clientEmail],
      ['Monthly Revenue', `£${total.toFixed(2)} + VAT`],
      ['Annual Revenue', `${fmtGBP(total * 12)} + VAT`],
      ['Previous Accountant', d.noPrevAccountant ? 'New business — no previous accountant' : (d.prevFirmName || 'Not provided')],
    ].map(([k, v]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;width:160px;vertical-align:top">${k}</td>
      <td style="padding:6px 0;font-size:13px;color:#111;font-weight:500">${v}</td>
    </tr>`).join('')}
  </table>

  ${serviceTable(d.services)}

  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:14px 18px;margin-top:16px">
    <p style="margin:0;font-size:13px;font-weight:700;color:#991b1b">Action Checklist</p>
    <ul style="margin:8px 0 0;padding-left:20px">
      ${d.noPrevAccountant ? '' : `<li style="margin:4px 0;font-size:13px;color:#374151">Await professional clearance response from ${d.prevFirmName || 'previous accountant'}</li>`}
      <li style="margin:4px 0;font-size:13px;color:#374151">Set up GoCardless Direct Debit for ${d.clientEmail}</li>
      <li style="margin:4px 0;font-size:13px;color:#374151">Register client on HMRC and Companies House portals</li>
      <li style="margin:4px 0;font-size:13px;color:#374151">Request ${d.firm.mtdEmail === d.firm.email ? 'MTD software' : `MTD software invite to ${d.firm.mtdEmail}`}</li>
      <li style="margin:4px 0;font-size:13px;color:#374151">Complete client onboarding checklist in practice management</li>
    </ul>
  </div>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `Internal notification only · ${d.firm.legalName}`);
}

// ─── 6. Client Welcome Email — after signing ──────────────────────────────────

interface ClientWelcomeData {
  firm: FirmConfig;
  companyName: string;
  directorName: string;
  services: Array<{ name: string; price: number }>;
  docUploadUrl?: string;
  today: string;
}

export function buildClientWelcomeEmail(d: ClientWelcomeData): string {
  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <p style="margin:0 0 16px;font-size:15px;color:#374151">Dear ${d.directorName || 'Director'},</p>
  <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7">
    Thank you for completing your engagement with <strong>${d.firm.legalName}</strong>. We are delighted to
    welcome <strong>${d.companyName}</strong> as a client and look forward to supporting your business.
  </p>
  <p style="margin:0 0 12px;font-size:14px;color:#374151">Here is a summary of your agreed services:</p>
  ${serviceTable(d.services)}

  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 18px;margin-top:16px">
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1e40af">Your Next Steps</p>
    <ul style="margin:0;padding-left:20px">
      <li style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.6">
        <strong>Direct Debit:</strong> We will set up your GoCardless Direct Debit — please ensure your bank details are current.
      </li>
      <li style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.6">
        <strong>Accounting Software:</strong> Please invite us to your Xero/QuickBooks/Sage account, or we can set one up for you.
      </li>
      <li style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.6">
        <strong>Records:</strong> If you have a previous accountant, we will liaise with them directly for the handover of your records.
      </li>
      <li style="margin:0;font-size:13px;color:#374151;line-height:1.6">
        <strong>Contact us:</strong> For any queries, please email <a href="mailto:${d.firm.email}" style="color:${d.firm.accentColor}">${d.firm.email}</a> or call ${d.firm.phone}.
      </li>
    </ul>
  </div>

  ${d.docUploadUrl ? `
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 18px;margin-top:16px">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e">⚡ Next Step: Upload Your Documents</p>
    <p style="margin:0 0 14px;font-size:13px;color:#78350f;line-height:1.6">
      To complete your onboarding, please upload your required documents — passport, proof of address, UTR letters, and more.
      Our secure portal guides you through each document step by step.
    </p>
    ${actionButton(d.docUploadUrl, 'Upload Documents Now', d.firm.accentColor)}
  </div>` : ''}

  <p style="margin:24px 0 0;font-size:14px;color:#374151">
    Yours sincerely,<br>
    <strong>${d.firm.partnerName}</strong><br>
    <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle} · ${d.firm.legalName}</span>
  </p>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}`);
}

// ─── 7. Clearance Response Notification — to firm ────────────────────────────

interface ClearanceResultData {
  firm: FirmConfig;
  companyName: string;
  companyNumber: string;
  directorName: string;
  respondentName: string;
  respondentFirm: string;
  decision: 'accept' | 'reject';
  outstandingFees: 'yes' | 'no';
  feeAmount?: string;
  concerns?: string;
  transferMethod?: string;
  today: string;
}

export function buildClearanceResultEmail(d: ClearanceResultData): string {
  const isGranted = d.decision === 'accept';
  const content = `
${letterhead(d.firm, d.today)}
<div style="padding:24px 36px">
  <div style="background:${isGranted ? '#f0fdf4' : '#fef2f2'};border:1px solid ${isGranted ? '#86efac' : '#fca5a5'};border-radius:8px;padding:14px 18px;margin-bottom:20px">
    <p style="margin:0;font-size:15px;font-weight:700;color:${isGranted ? '#166534' : '#991b1b'}">
      ${isGranted ? '✅ Professional Clearance Granted' : '⚠️ Professional Clearance Withheld'}
    </p>
    <p style="margin:4px 0 0;font-size:12px;color:${isGranted ? '#4ade80' : '#f87171'}">${d.today}</p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
    ${[
      ['Company', `${d.companyName} (CH: ${d.companyNumber})`],
      ['Director', d.directorName || '—'],
      ['Previous Accountant', `${d.respondentName} · ${d.respondentFirm}`],
      ['Decision', isGranted ? 'Clearance Granted' : 'Clearance Withheld'],
      ...(d.outstandingFees === 'yes' ? [['Outstanding Fees', d.feeAmount || 'Amount not specified']] : []),
      ...(isGranted && d.transferMethod ? [['Records Transfer', d.transferMethod]] : []),
    ].map(([k, v]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;width:180px;vertical-align:top">${k}</td>
      <td style="padding:6px 0;font-size:13px;color:#111;font-weight:500">${v}</td>
    </tr>`).join('')}
  </table>

  ${d.concerns ? `
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:16px">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px">Additional Notes from Previous Accountant</p>
    <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.6">${d.concerns}</p>
  </div>` : ''}

  <div style="background:${isGranted ? '#f0fdf4' : '#fef2f2'};border:1px solid ${isGranted ? '#86efac' : '#fca5a5'};border-radius:8px;padding:14px 18px">
    <p style="margin:0;font-size:13px;font-weight:700;color:${isGranted ? '#166534' : '#991b1b'}">
      ${isGranted
        ? 'Action: Proceed with onboarding. Contact the previous accountant to arrange records transfer.'
        : 'Action: Clearance withheld — review the notes above and discuss with the client before proceeding.'}
    </p>
  </div>
</div>`;
  return emailShell(d.firm.accentColor, content,
    `Internal notification only · ${d.firm.legalName}`);
}
