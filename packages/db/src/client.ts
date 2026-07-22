import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

/**
 * Database client (A2 §5 — the service layer is the only writer to Postgres).
 *
 * A single pooled postgres-js connection per server instance, lazily created.
 * Connection string comes from DATABASE_URL (Supabase EU). For Supabase use the
 * pooled (Supavisor) port in serverless to avoid connection exhaustion.
 */
export type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let db: Database | null = null;

export function getDb(connectionString = process.env.DATABASE_URL): Database {
  if (db) return db;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot create database client.");
  }
  client = postgres(connectionString, { prepare: false, max: 10 });
  db = drizzle(client, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    db = null;
  }
}

/**
 * Minimal session context for RLS (structurally compatible with @gns/core's
 * AuthSession — kept local so @gns/db has no dependency on @gns/core).
 */
export interface SessionContext {
  userId: string;
  roles: string[];
  entityIds: string[];
  clientId?: string;
  isAdmin: boolean;
}

type TxCallback = Parameters<Database["transaction"]>[0];
export type Tx = Parameters<TxCallback>[0];

/**
 * Run `fn` inside a transaction with the RLS GUCs set from the session
 * (A2 §10, A3 §7). Postgres policies (migration 0001) read these via
 * current_setting(...), so all reads/writes are entity/ownership scoped.
 * The service layer uses this for every authenticated DB access.
 */
export async function withSession<T>(
  ctx: SessionContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const database = getDb();
  return database.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`);
    await tx.execute(sql`select set_config('app.roles', ${ctx.roles.join(",")}, true)`);
    await tx.execute(sql`select set_config('app.entity_ids', ${ctx.entityIds.join(",")}, true)`);
    await tx.execute(sql`select set_config('app.client_id', ${ctx.clientId ?? ""}, true)`);
    await tx.execute(sql`select set_config('app.is_admin', ${ctx.isAdmin ? "true" : "false"}, true)`);
    return fn(tx);
  });
}

export { schema };
