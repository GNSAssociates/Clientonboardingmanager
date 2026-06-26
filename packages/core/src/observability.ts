// Structured logger — zero-dependency, JSON output in production, pretty in dev
// PII-sensitive fields should never be passed directly to log calls

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");

type LogLevel = "debug" | "info" | "warn" | "error";
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[level as LogLevel] ?? 20;

function log(lvl: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (LEVELS[lvl] < threshold) return;
  const entry = { level: lvl, msg, time: new Date().toISOString(), ...meta };
  if (isProd) {
    // JSON line — compatible with Vercel Log Drains / CloudWatch
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    const prefix = `[${lvl.toUpperCase()}]`;
    const extra = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${prefix} ${msg}${extra}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  child: (ctx: Record<string, unknown>) => ({
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, { ...ctx, ...meta }),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, { ...ctx, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, { ...ctx, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, { ...ctx, ...meta }),
  }),
};

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export function auditLog(event: {
  entityId: string;
  userId: string;
  eventType: string;
  tableName?: string;
  recordId?: string;
  detail?: Record<string, unknown>;
}) {
  log("info", `audit:${event.eventType}`, { ...event, audit: true });
}
