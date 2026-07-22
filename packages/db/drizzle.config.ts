import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration (A3 §8 — migration strategy).
 * Migrations are SQL files checked into ./migrations and applied in CI before
 * app deploy. `generate` works offline from the schema; `migrate` needs DATABASE_URL.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
  strict: true,
  verbose: true,
});
