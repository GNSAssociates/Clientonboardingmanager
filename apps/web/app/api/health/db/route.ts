import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createConnection } from "@gns/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Database migration probe (operator-only), served over HTTP.
 *
 * The same checks as scripts/cpanel/db-probe.cjs, but callable directly so the
 * result can be read without cPanel's script runner — which gives no output
 * when a connection stalls.
 *
 * READ ONLY on the live database. Against the target it may enable pgcrypto,
 * which is required for UUID generation on PostgreSQL below 13.
 *
 * Locked with AUTH_SHIM_SECRET (already set on the server); 404 otherwise so it
 * is invisible to probing.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTH_SHIM_SECRET ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Never echo credentials back: postgres://user:pass@host/db → host:port/db. */
function describe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
}

const connect = (url: string) => createConnection(url);

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const SOURCE = process.env.DATABASE_URL;
  const TARGET = process.env.TARGET_DATABASE_URL;
  const out: Record<string, unknown> = {};

  if (!SOURCE) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
  if (!TARGET) {
    return NextResponse.json(
      { error: "TARGET_DATABASE_URL is not set on this app", hint: "Add it in Setup Node.js App, then Restart." },
      { status: 500 },
    );
  }

  // ── Source (live) ───────────────────────────────────────────────────────────
  const source: Record<string, unknown> = { at: describe(SOURCE) };
  const src = connect(SOURCE);
  try {
    const [v] = await src`select version()`;
    source.version = String(v?.version ?? "").split(",")[0];
    // One round trip for every table, rather than one per table.
    const rows = (await src`
      select c.relname as tbl, coalesce(s.n_live_tup, 0)::int as rows
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_stat_user_tables s on s.relid = c.oid
      where n.nspname = 'public' and c.relkind = 'r'
      order by 2 desc, 1`) as unknown as Array<{ tbl: string; rows: number }>;
    source.tables = rows.length;
    source.totalRows = rows.reduce((sum, r) => sum + r.rows, 0);
    source.rowCounts = Object.fromEntries(rows.filter((r) => r.rows > 0).map((r) => [r.tbl, r.rows]));
    const [size] = await src`select pg_size_pretty(pg_database_size(current_database())) as s`;
    source.size = size?.s;
    source.ok = true;
  } catch (e) {
    source.ok = false;
    source.error = e instanceof Error ? e.message : String(e);
  } finally {
    await src.end({ timeout: 5 }).catch(() => {});
  }
  out.source = source;

  // ── Target (cPanel) ─────────────────────────────────────────────────────────
  const target: Record<string, unknown> = { at: describe(TARGET) };
  const dst = connect(TARGET);
  try {
    const [v] = await dst`select version()`;
    const versionText = String(v?.version ?? "").split(",")[0] ?? "";
    target.version = versionText;
    target.majorVersion = parseInt((versionText.match(/PostgreSQL (\d+)/) ?? [])[1] ?? "0", 10);

    const existing = (await dst`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`) as unknown as Array<{ table_name: string }>;
    target.existingTables = existing.length;
    target.isEmpty = existing.length === 0;

    // 42 id columns default to gen_random_uuid(): built in from PostgreSQL 13,
    // otherwise supplied by the pgcrypto extension.
    try {
      await dst`select gen_random_uuid()`;
      target.uuidGeneration = "available";
    } catch {
      try {
        await dst`create extension if not exists pgcrypto`;
        await dst`select gen_random_uuid()`;
        target.uuidGeneration = "enabled via pgcrypto";
      } catch (e2) {
        target.uuidGeneration = "UNAVAILABLE";
        target.uuidError = e2 instanceof Error ? e2.message : String(e2);
      }
    }

    const [priv] = await dst`
      select has_database_privilege(current_user, current_database(), 'CREATE') as can_create,
             current_user as db_user`;
    target.canCreate = priv?.can_create ?? false;
    target.user = priv?.db_user;
    target.ok = true;
  } catch (e) {
    target.ok = false;
    target.error = e instanceof Error ? e.message : String(e);
    target.hint =
      "Check the database name, user and password, and that the user was added to the database with ALL PRIVILEGES.";
  } finally {
    await dst.end({ timeout: 5 }).catch(() => {});
  }
  out.target = target;

  const ready =
    source.ok === true &&
    target.ok === true &&
    target.isEmpty === true &&
    target.canCreate === true &&
    target.uuidGeneration !== "UNAVAILABLE";
  out.verdict = ready ? "READY" : "NOT READY";

  return NextResponse.json(out, { status: 200 });
}
