export { renderTemplate, wrapHtml } from "./engine";
export { AUTH_LETTER_TEMPLATE } from "./auth-letter";
export { ENGAGEMENT_LETTER_TEMPLATE } from "./engagement-letter";
export { CLEARANCE_REQUEST_TEMPLATE } from "./clearance-request";

export const TEMPLATE_KEYS = {
  AUTH_LETTER: "auth_letter",
  ENGAGEMENT_LETTER: "engagement_letter",
  CLEARANCE_REQUEST: "clearance_request",
} as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];
