/**
 * Pre-migration probe — READ ONLY on the live database.
 *
 * Run from cPanel's Node.js App screen ("Run JS script" → db:probe) so it
 * executes on the server itself: no SSH, and the cPanel PostgreSQL server is
 * reachable on localhost even when it refuses outside connections.
 *
 * Reports everything needed to decide whether the live Supabase database can be
 * moved onto this cPanel PostgreSQL server, and prints row counts to compare
 * against after the copy.
 *
 * Reads:
 *   DATABASE_URL        - the live database (source)
 *   TARGET_DATABASE_URL - the new cPanel database (destination)
 */
const postgres = require("postgres");

const SOURCE = process.env.DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL;

/** Never print credentials: postgres://user:pass@host/db → host/db. */
function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
}

function connect(url) {
  return postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 20 });
}

async function main() {
  console.log("=".repeat(66));
  console.log("  GNS platform - database migration probe (read only)");
  console.log("=".repeat(66));
  console.log(`Node: ${process.version}\n`);

  if (!SOURCE) {
    console.log("FAIL: DATABASE_URL is not set in this app's environment.");
    process.exit(1);
  }
  if (!TARGET) {
    console.log("FAIL: TARGET_DATABASE_URL is not set.");
    console.log("      Add it in cPanel > Setup Node.js App > Environment variables:");
    console.log("      postgresql://USER:PASSWORD@localhost:5432/DBNAME");
    process.exit(1);
  }

  // ── Source ────────────────────────────────────────────────────────────────
  console.log(`SOURCE (live)  : ${describe(SOURCE)}`);
  let counts = {};
  let total = 0;
  const src = connect(SOURCE);
  try {
    const [v] = await src`select version()`;
    console.log(`  version      : ${String(v.version).split(",")[0]}`);

    const tables = await src`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`;
    console.log(`  tables       : ${tables.length}`);

    for (const { table_name } of tables) {
      const [row] = await src.unsafe(`select count(*)::int as n from "${table_name}"`);
      counts[table_name] = row.n;
      total += row.n;
    }
    console.log(`  total rows   : ${total}\n`);
    console.log("  Row counts (compare these after the copy):");
    for (const [name, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      if (n > 0) console.log(`    ${String(n).padStart(7)}  ${name}`);
    }
    const empty = Object.entries(counts).filter(([, n]) => n === 0).length;
    console.log(`    (${empty} further tables are empty)\n`);
  } catch (e) {
    console.log(`  FAILED to read source: ${e.message}\n`);
    process.exitCode = 1;
  } finally {
    await src.end({ timeout: 5 }).catch(() => {});
  }

  // ── Target ────────────────────────────────────────────────────────────────
  console.log(`TARGET (cPanel): ${describe(TARGET)}`);
  const dst = connect(TARGET);
  try {
    const [v] = await dst`select version()`;
    const versionText = String(v.version).split(",")[0];
    console.log(`  version      : ${versionText}`);
    const major = parseInt((versionText.match(/PostgreSQL (\d+)/) || [])[1] || "0", 10);

    const existing = await dst`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`;
    console.log(`  tables       : ${existing.length} ${existing.length === 0 ? "(empty - ready)" : "(NOT empty)"}`);

    // The schema defaults 42 id columns to gen_random_uuid(). Built in from
    // PostgreSQL 13; before that it needs the pgcrypto extension.
    let uuidOk = false;
    try {
      await dst`select gen_random_uuid()`;
      uuidOk = true;
      console.log("  gen_random_uuid(): available");
    } catch {
      console.log("  gen_random_uuid(): MISSING - trying to enable pgcrypto...");
      try {
        await dst`create extension if not exists pgcrypto`;
        await dst`select gen_random_uuid()`;
        uuidOk = true;
        console.log("  pgcrypto      : enabled successfully");
      } catch (e2) {
        console.log(`  pgcrypto      : COULD NOT ENABLE (${e2.message})`);
      }
    }

    const [priv] = await dst`
      select has_database_privilege(current_user, current_database(), 'CREATE') as can_create`;
    console.log(`  can create   : ${priv.can_create}`);

    console.log("\n" + "-".repeat(66));
    if (existing.length === 0 && uuidOk && priv.can_create) {
      console.log("VERDICT: READY. The database can be created and filled here.");
      console.log(`         ${total} rows to copy from ${describe(SOURCE)}.`);
      if (major && major < 13) {
        console.log(`         Note: PostgreSQL ${major} - pgcrypto is providing UUIDs.`);
      }
    } else {
      console.log("VERDICT: NOT READY - see the failures above.");
      if (existing.length > 0) console.log("         The target already has tables; use an empty database.");
      if (!uuidOk) console.log("         UUID generation is unavailable; tell Claude and it will be handled in code.");
      if (!priv.can_create) console.log("         The user lacks CREATE on the database; grant ALL PRIVILEGES in cPanel.");
    }
    console.log("-".repeat(66));
  } catch (e) {
    console.log(`  FAILED to reach target: ${e.message}`);
    console.log("  Check the database name, user, password and that the user was");
    console.log("  added to the database with ALL PRIVILEGES in cPanel.");
    process.exitCode = 1;
  } finally {
    await dst.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error("Probe crashed:", e.message);
  process.exit(1);
});
