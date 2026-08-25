# UK/EU Data Migration Runbook — cPanel Postgres → Supabase `gns-eu`

**Status:** planned, not yet executed.
**Audience:** whoever runs the migration (keep this open on a second screen).
**Live clients are on the current database.** Nothing here is irreversible until
Step 7, and Step 8 is the rollback.

---

## 0. What we already know

| Fact | Why it matters |
|---|---|
| `gns-eu` **already has the schema** (tables visible in Schema Visualizer) | We are migrating **data**, not creating tables — but see the journal warning below |
| Supabase reports **"No migrations"** | The schema was applied by `drizzle-kit push` (or by hand), so `supabase_migrations` is empty. Running `drizzle-kit migrate` against it would try to re-apply all 31 migrations and fail on existing objects |
| Migrations **never run automatically** on this deployment | CI cannot reach the cPanel database. Whatever state the DB is in is what the app gets |
| 45 tables, 31 migrations | Full list in `packages/db/migrations/` |
| Signed engagement letters live **in the database** (`onboarding_links.signed_html`) | Losing a row loses a signed contract. This is AML/record-keeping material |
| Client ID documents do **not** live in the database | They are in OneDrive (and optionally Supabase Storage). Migrating the DB does **not** move them |

> **Do not** run `pnpm db:migrate` against `gns-eu` before Step 3. It will fail
> half-way and leave the schema in an unknown state.

---

## 1. Pre-flight assessment (read-only, do this first)

Run in the **Supabase SQL Editor** on `gns-eu`:

```sql
-- Which of our tables exist, and how full are they?
SELECT table_name,
       (xpath('/row/c/text()',
        query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                     false, true, '')))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY row_count DESC, table_name;
```

```sql
-- Is the drizzle journal present? (expect 0 rows / missing table)
SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

And on the **current cPanel database** (same queries) so you have a
before-and-after row count for every table.

**Record both outputs in a file.** They are the acceptance test in Step 6.

---

## 2. Full backup (non-negotiable)

```bash
# From a machine that can reach the cPanel Postgres
pg_dump --format=custom --no-owner --no-privileges \
        --file=gns-prod-$(date +%Y%m%d-%H%M).dump \
        "postgresql://USER:PASS@HOST:5432/DBNAME"
```

Verify the dump is readable **before** proceeding:
```bash
pg_restore --list gns-prod-*.dump | head -30
```

Also take a Supabase backup (Database → Backups) so `gns-eu` itself can be rolled back.

Keep both off the server (local + one other location).

---

## 3. Reconcile the schema and baseline the journal

Because `gns-eu` has tables but no journal, choose **one**:

**Option A — trust the existing schema (faster).** Confirm it matches by diffing
the table list from Step 1 against `packages/db/migrations/`. Then baseline the
journal so future migrations run from the right point:

```sql
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
);
-- Insert one row per already-applied migration tag, in journal order.
-- Take the tags and `when` values from packages/db/migrations/meta/_journal.json
```

**Option B — start clean (safer, recommended if `gns-eu` holds no real data).**
Drop the public schema on `gns-eu` and let migrations build it properly:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
```
then, locally, with `DATABASE_URL` pointing at `gns-eu`:
```bash
pnpm --filter @gns/db migrate
```
This applies all 31 migrations **including the RLS policies** and records the
journal correctly.

> Option B is preferred. The RLS migrations (0001, 0003, 0005, 0007, 0009, 0011,
> 0013) are security policy — if the current `gns-eu` schema was pushed without
> them, tables are unprotected.
>
> **Confirm `gns-eu` has no real data before dropping anything** (Step 1 row counts).

---

## 4. Move the data

With the schema in place and **empty**:

```bash
# Data only, no schema, no owner/ACL differences
pg_restore --data-only --disable-triggers --no-owner --no-privileges \
           --dbname="postgresql://postgres:PASS@db.gxvafxtnnfmfsvjfzqdv.supabase.co:5432/postgres" \
           gns-prod-YYYYMMDD-HHMM.dump
```

`--disable-triggers` avoids foreign-key ordering problems. If it is refused
(Supabase restricts superuser), restore table-by-table in dependency order
instead: `entities` → `users`/`roles`/`user_roles` → `clients` →
`onboarding_links` → `document_submissions` → everything else.

---

## 5. Point the app at the new database

Only after Step 6 verification passes on a **copy**, or during the agreed window:

- cPanel → onboarding app → Environment variables → set `DATABASE_URL` to the
  Supabase connection string (note: port **5432** direct, or **6543** pooled —
  use the pooled connection string for a serverless-style app).
- **Keep the old `DATABASE_URL` written down.** That is the rollback.
- Restart the app (**STOP** then **START** — a plain Restart often does not take).

---

## 6. Verification (the acceptance test)

Do not declare success until every one of these passes:

- [ ] `GET /api/version` responds (app boots against the new DB)
- [ ] Row counts per table match Step 1's cPanel figures **exactly**
- [ ] `SELECT count(*) FROM onboarding_links WHERE signed_html IS NOT NULL;` matches — **signed contracts are intact**
- [ ] `SELECT count(*) FROM document_submissions WHERE status='uploaded';` matches
- [ ] Staff dashboard lists the same clients as before
- [ ] Open one signed engagement → the signed PDF + audit report renders
- [ ] Create a test onboarding link end-to-end → it appears and emails send
- [ ] `GET /api/health/db?...` healthy
- [ ] RLS present: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=true;` returns the expected tables

---

## 7. Point of no return

New client activity written to `gns-eu` will **not** exist in the old database.
From here, rolling back means losing anything created since the switch — so
either do it in a quiet window, or accept re-keying.

---

## 8. Rollback

1. Set `DATABASE_URL` back to the cPanel connection string.
2. **STOP** then **START** the app.
3. Verify the dashboard shows clients again.

Because Steps 1–6 are read-only on the source, the old database is untouched and
rollback is immediate. Re-key anything created on `gns-eu` after Step 7.

---

## 9. What this migration does NOT do

- **Does not move client documents.** IDs and proofs of address are in OneDrive
  (and Supabase Storage if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set).
  They are unaffected.
- **Does not move the invoice app.** That is a separate SQLite database on cPanel.
- **Does not change GoCardless.** Mandates live at GoCardless; we only store ids.

---

## 10. Suggested window

| Phase | Time | Client impact |
|---|---|---|
| Steps 1–2 (assess + backup) | 30–45 min | none — read-only |
| Step 3 (schema) | 15–30 min | none |
| Step 4 (data restore) | 15–60 min, depends on size | none |
| Steps 5–6 (switch + verify) | 30–45 min | **app down/read-only** |
| Buffer | 60 min | — |

Pick a window with no client signings expected — early morning or a weekend.
Total ~3 hours with the buffer; the client-visible outage is the 30–45 minutes
of Steps 5–6.

---

## 11. Before you start — decide these

1. **Option A or B in Step 3?** (B recommended, but only if `gns-eu` has no real data.)
2. **Pooled or direct connection string?** (Pooled, port 6543, is usually right.)
3. **Are documents moving to Supabase Storage too, or staying OneDrive-only?**
4. **Who is on call** during the window if verification fails?
