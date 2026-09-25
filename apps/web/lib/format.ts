export function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Tidy a name for storage: collapse any run of whitespace to one space and trim.
 *
 * Nothing normalised names before this, so whatever arrived was stored verbatim
 * — a double space from a paste, or from Companies House's own data, which is
 * not uniformly clean. It then followed the client everywhere: the engagement
 * letter, the clearance letter posted to another firm, and the PDF filenames.
 * "TRIAL  LTD" on a contract looks like carelessness, and it is the sort of
 * thing nobody notices until it is in front of a client.
 *
 * Also catches non-breaking spaces (U+00A0), which paste in from web pages and
 * Word looking exactly like a normal space.
 */
export function tidyName(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s\u00A0]+/g, " ").trim();
}
