export { renderTemplate, wrapHtml } from "./engine";
export { AUTH_LETTER_TEMPLATE } from "./auth-letter";
export { ENGAGEMENT_LETTER_TEMPLATE } from "./engagement-letter";
export { CLEARANCE_REQUEST_TEMPLATE } from "./clearance-request";
export { renderCompletionReport } from "./completion-report";
export type { CompletionReportData } from "./completion-report";

export const TEMPLATE_KEYS = {
  AUTH_LETTER: "auth_letter",
  ENGAGEMENT_LETTER: "engagement_letter",
  CLEARANCE_REQUEST: "clearance_request",
  COMPLETION_REPORT: "completion_report",
} as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];
