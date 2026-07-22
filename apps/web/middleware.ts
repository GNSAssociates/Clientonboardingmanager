import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware (A2 §13). Stamps a correlation id on every request so logs,
 * traces and error reports can be tied together. Auth/session resolution
 * (Entra for staff, Supabase for clients) is layered in here in M1.
 */
export function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? `req_${crypto.randomUUID()}`;
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
