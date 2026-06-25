# GNS Onboarding & Compliance Platform

AI-powered client onboarding and compliance platform for **GNS Associates** (entities GNS / LLP / GXY).

> **Design blueprint:** see [`docs/`](docs/README.md) (PRD, architecture, DB, API, n8n, wireframes, backlog).
> **Build status:** Module **M0 — Foundation & infra** (this scaffold). Subsequent modules M1–M14 per [docs/07-backlog.md](docs/07-backlog.md).

## Stack
Next.js 14 (App Router, TS) · Supabase (Postgres/RLS/Auth/Storage, EU) · Drizzle ORM · n8n · Claude (Anthropic API) · Microsoft Graph · Vercel. All infrastructure is **EU/UK region** for data residency.

## Monorepo layout
```
apps/web              Next.js app (client/staff/admin portals + API)
packages/config       Typed env, Zod schemas, entity + domain constants
packages/db           Drizzle schema, migrations, DB client (RLS in M1)
packages/core         Domain logic: state machine, errors, hexagonal ports
packages/ai           AI agent framework (agents added in M3/M5/M6/M8/M9)
packages/integrations Adapters implementing ports (added M4–M7)
docs/                 Design blueprint A1–A7
supabase/             Local Supabase config
.github/workflows/    CI (typecheck, lint, test, build)
```

## Prerequisites
- Node 20+ (this machine has 24) · pnpm 9 (`npm i -g pnpm@9`) · Docker (for local Supabase) · Supabase CLI (optional, for local DB).

## Getting started
```bash
pnpm install
cp .env.example .env.local          # fill in as modules require credentials
pnpm dev                            # http://localhost:3000
```
Visit `/` (portal selector), `/client`, `/staff`, `/admin`, and `/api/health`.

## Common scripts
```bash
pnpm typecheck      # tsc across all packages
pnpm lint           # next lint
pnpm test           # vitest (unit)
pnpm build          # next build (must pass without secrets)
pnpm db:generate    # drizzle-kit: generate SQL migration from schema
pnpm db:migrate     # apply migrations (needs DATABASE_URL)
pnpm db:studio      # drizzle studio
```

## Database
- Schema lives in `packages/db/src/schema`. Generate a migration after schema changes:
  ```bash
  pnpm db:generate     # writes SQL to packages/db/migrations
  pnpm db:migrate      # applies to DATABASE_URL (Supabase EU / local)
  ```
- M0 establishes the cross-cutting foundation (entities, users, roles, audit log, outbox events). Domain tables are added per module.

## Deployment (target)
- **App:** Vercel (EU region). Connect the repo; set env vars from `.env.example`; `pnpm build` is the build command.
- **Database/Auth/Storage:** Supabase project in an **EU region** (London/Frankfurt). Apply migrations in CI before deploy.
- **n8n:** self-hosted in EU; reaches the app only via signed webhooks (wired in M12).
- **CI:** GitHub Actions runs typecheck/lint/test/build on every PR (`.github/workflows/ci.yml`); migrations gated before deploy.

## Security & compliance posture
RLS + RBAC, encrypted secrets/tokens, append-only audit log, UK/EU residency, Claude under a no-training DPA. See [docs/02-architecture.md](docs/02-architecture.md) §10 and [docs/01-prd.md](docs/01-prd.md) §10/§13.
