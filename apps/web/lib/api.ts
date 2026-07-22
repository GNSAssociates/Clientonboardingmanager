import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, type ErrorCode } from "@gns/core";
import { newRequestId, reportError } from "./observability";

/**
 * API error envelope (A4 §4). Maps typed domain errors and Zod failures to a
 * consistent JSON shape + HTTP status. Unexpected errors are reported and
 * returned as 500 with a correlation id only (never leak internals).
 */
const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ILLEGAL_TRANSITION: 409,
  INTEGRATION_ERROR: 502,
  INTERNAL: 500,
};

export function apiError(error: unknown): NextResponse {
  const requestId = newRequestId();

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })),
          requestId,
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details, requestId } },
      { status: STATUS[error.code] },
    );
  }

  reportError(error, { requestId });
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Internal server error", requestId } },
    { status: 500 },
  );
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
    { status: 401 },
  );
}
