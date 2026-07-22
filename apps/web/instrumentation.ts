// Next.js instrumentation hook — runs once at server startup
// Sentry loaded dynamically to avoid compile-time dep on @sentry/nextjs

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = new Function("m", "return import(m)") as (m: string) => Promise<any>;
    const sentry = await load("@sentry/nextjs");
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend(event: Record<string, unknown>) {
        const req = event.request as Record<string, unknown> | undefined;
        if (req?.cookies) req.cookies = "[REDACTED]";
        return event;
      },
    });
  }
}
