/**
 * Typed error hierarchy (A2 §13 — error handling & exception management).
 * Mapped to the API error envelope (A4 §4) at the boundary.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ILLEGAL_TRANSITION"
  | "INTEGRATION_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", message);
  }
}

/** Raised when a state-machine guard rejects a transition (A2 §5, FR-WF-1). */
export class IllegalTransitionError extends AppError {
  constructor(from: string, to: string) {
    super("ILLEGAL_TRANSITION", `Illegal transition: ${from} -> ${to}`, { from, to });
  }
}

/** Raised when an external provider call fails after retries (A2 §9, §13). */
export class IntegrationError extends AppError {
  constructor(provider: string, message: string, details?: unknown) {
    super("INTEGRATION_ERROR", `[${provider}] ${message}`, details);
  }
}
