/**
 * ACCA (Association of Chartered Certified Accountants) logo data URI.
 * Official-style red mark (solid red block, white "ACCA") matching the ACCA
 * letterhead logo. Swap in the exact official artwork PNG/SVG when supplied.
 */
const ACCA_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">` +
  `<rect width="80" height="80" rx="6" fill="#E4002B"/>` +
  `<text x="40" y="52" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="26" letter-spacing="0.5" fill="#fff">ACCA</text>` +
  `<text x="92" y="36" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="15" fill="#333">Chartered Certified</text>` +
  `<text x="92" y="56" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="15" fill="#333">Accountants</text>` +
  `</svg>`;

export const ACCA_LOGO_DATA_URI =
  'data:image/svg+xml;base64,' + (typeof Buffer !== 'undefined'
    ? Buffer.from(ACCA_SVG).toString('base64')
    : btoa(ACCA_SVG));
