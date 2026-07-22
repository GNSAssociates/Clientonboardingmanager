/**
 * Engagement letter email template — GNS Associates format
 */
import type { FirmConfig } from './firms';
import { fmtGBP } from './format';

export interface EngagementEmailData {
  firm: FirmConfig;
  clientCompanyName: string;
  clientCompanyNumber: string;
  clientAddress: string;
  clientDirectorName: string;
  clientDirectorEmail: string;
  services: Array<{ name: string; monthlyFee: number; annualFee: number }>;
  totalMonthlyFee: number;
  totalAnnualFee: number;
  signatureLink: string;
  deadline: string;
}

export function buildEngagementEmail(d: EngagementEmailData): string {
  const serviceRows = d.services
    .map(s => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151">${s.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;color:#6b7280">${fmtGBP(s.monthlyFee)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;color:#6b7280">${fmtGBP(s.annualFee)}</td>
      </tr>
    `)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${d.firm.accentColor},#1e3a8a);font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:32px 36px">
    ${(() => { const u = process.env.NEXT_PUBLIC_APP_URL?.trim(); return u && !u.startsWith('http://localhost') ? `<img src="${u}${d.firm.logo}" alt="${d.firm.name}" height="52" style="display:block;margin-bottom:14px">` : ''; })()}
    <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#111">${d.firm.legalName}</p>
    <p style="margin:0 0 2px;font-size:12px;color:#6b7280">${d.firm.address}, ${d.firm.city}, ${d.firm.postcode}</p>
    <p style="margin:0 0 24px;font-size:12px;color:#6b7280">${d.firm.phone} | ${d.firm.email}</p>

    <div style="height:1px;background:#e5e7eb;margin-bottom:24px"></div>

    <p style="margin:0 0 20px;font-size:14px;color:#374151">Dear ${d.clientDirectorName},</p>

    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
      We are pleased to confirm our appointment as accountants for:
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#111">${d.clientCompanyName}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Company No: ${d.clientCompanyNumber}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">${d.clientAddress}</p>
    </div>

    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
      The following services have been agreed, with fees as outlined:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 20px">
      <thead><tr style="background:#f9fafb">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Service</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Monthly</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Annual</th>
      </tr></thead>
      <tbody>
        ${serviceRows}
        <tr style="background:#f9fafb">
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#111">Total</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#111">${fmtGBP(d.totalMonthlyFee)}</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#111">${fmtGBP(d.totalAnnualFee)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:10px 12px;font-size:12px;color:#6b7280">Plus 20% VAT on all fees</td>
        </tr>
      </tbody>
    </table>

    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
      Please review the full terms and conditions, including our scope of work and limitations of liability. If you agree, please sign below to confirm your acceptance of this engagement.
    </p>

    <div style="text-align:center;margin:24px 0">
      <a href="${d.signatureLink}" style="display:inline-block;background:${d.firm.accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">
        Review & Sign Engagement Letter
      </a>
    </div>

    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
      Please sign and return this letter by <strong>${d.deadline}</strong> to confirm your instructions.
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#374151">
      Yours faithfully,<br>
      <strong>${d.firm.partnerName}</strong><br>
      <span style="color:#6b7280;font-size:13px">${d.firm.partnerTitle}</span><br>
      <span style="color:#6b7280;font-size:13px">${d.firm.legalName}</span>
    </p>
  </td></tr>
  <tr><td style="padding:16px 36px 24px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#9ca3af">${d.firm.legalName} · ${d.firm.address}, ${d.firm.city}, ${d.firm.postcode} · ${d.firm.regStatement}</p>
  </td></tr>
</table></td></tr></table></body></html>`;

  return html;
}
