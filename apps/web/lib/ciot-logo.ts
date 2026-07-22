/**
 * CIOT (Chartered Institute of Taxation) logo data URI.
 * Simple text-based SVG placeholder — replace with official logo PNG when available.
 */
export const CIOT_LOGO_DATA_URI =
  'data:image/svg+xml;base64,' + (typeof Buffer !== 'undefined'
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="4" fill="#fff"/><rect x="2" y="2" width="196" height="76" rx="3" fill="none" stroke="#003B5C" stroke-width="2"/><text x="100" y="50" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="28" fill="#003B5C">CIOT</text></svg>`).toString('base64')
    : btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="4" fill="#fff"/><rect x="2" y="2" width="196" height="76" rx="3" fill="none" stroke="#003B5C" stroke-width="2"/><text x="100" y="50" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="28" fill="#003B5C">CIOT</text></svg>`));
