import "server-only";
import pino from "pino";

/**
 * Structured logging (NFR-OBS-1). PII is never logged (NFR-PRIV-1) — callers
 * pass identifiers, not personal data. Level comes from LOG_LEVEL.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.token", "*.accessToken", "*.refreshToken"],
    censor: "[redacted]",
  },
  base: { service: "gns-onboarding-web" },
});

export type Logger = typeof logger;
