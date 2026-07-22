import { z } from "zod";

/**
 * Server-side environment validation (A2 §10, NFR-SEC-1).
 *
 * Fail fast: if a required variable is missing/invalid the process refuses to
 * start rather than failing deep inside a request. Secrets are validated but
 * never logged. Most integration keys are optional in M0 and become required
 * in their respective modules (M4–M7); they are typed as optional here so the
 * foundation builds and runs before credentials are provisioned.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Data layer
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_COMPLEX: z.string().default("claude-opus-4-8"),
  AI_MODEL_FAST: z.string().default("claude-haiku-4-5"),

  // Webhooks
  WEBHOOK_SIGNING_SECRET: z.string().min(8).default("dev-insecure-secret-change-me"),

  // Observability (optional)
  SENTRY_DSN: z.string().url().optional(),
});

/**
 * Public env (safe to expose to the browser; NEXT_PUBLIC_* only).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function loadPublicEnv(source: NodeJS.ProcessEnv = process.env): PublicEnv {
  return publicEnvSchema.parse(source);
}
