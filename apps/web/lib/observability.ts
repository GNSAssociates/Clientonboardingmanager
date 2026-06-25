import "server-only";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

/**
 * Observability seam (A2 §13, NFR-OBS-1).
 * - `newRequestId` stamps a correlation id onto each request/response.
 * - `reportError` is the single error sink. In M0 it logs structurally; the
 *   Sentry SDK is wired here in M14 (activates when SENTRY_DSN is set) without
 *   changing any call sites.
 */
export function newRequestId(): string {
  return `req_${randomUUID()}`;
}

export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  logger.error({ err: error, ...context }, "unhandled_error");
  // M14: if (process.env.SENTRY_DSN) Sentry.captureException(error, { extra: context });
}
