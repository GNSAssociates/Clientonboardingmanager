/**
 * CIOT (Chartered Institute of Taxation) logo data URI.
 * Clean navy wordmark (no box) matching the letterhead style. Swap in the exact
 * official CIOT artwork PNG/SVG when supplied.
 */
const CIOT_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">` +
  `<text x="4" y="46" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="34" letter-spacing="1" fill="#0B2A4A">CIOT</text>` +
  `<text x="6" y="64" font-family="Arial,Helvetica,sans-serif" font-weight="600" font-size="11.5" fill="#0B2A4A">Chartered Institute of Taxation</text>` +
  `</svg>`;

export const CIOT_LOGO_DATA_URI =
  'data:image/svg+xml;base64,' + (typeof Buffer !== 'undefined'
    ? Buffer.from(CIOT_SVG).toString('base64')
    : btoa(CIOT_SVG));
