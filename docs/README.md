# Design Blueprint — AI-Powered Client Onboarding & Compliance Platform

**Client:** GNS Associates (UK accountancy practice — entities **GNS**, **LLP**, **GXY**)
**Status:** Phase A (design blueprint) complete · awaiting sign-off to begin Phase B (build)

## Confirmed foundation
- **Blueprint-first**, then module-by-module build with approval gates.
- **Standalone system-of-record**; **hybrid auth** (Entra SSO staff / Supabase clients).
- **Fully white-labelled** per entity (branding, templates, bank, signatory, AML supervisor).
- **UK KYC/AML provider** integration; **provider-agnostic e-sign**; **deep Xero ledger read** (QBO second).
- **UK/EU residency**; **Claude via direct Anthropic API** (DPA, no-training).
- Stack: Next.js 14 + TS · Supabase (Postgres/RLS/Auth/Storage) · Drizzle · n8n · Claude · Microsoft Graph · Vercel (all EU).

## Documents
| # | Document | Contents |
|---|---|---|
| A1 | [Product Requirements (PRD)](01-prd.md) | Business/functional/non-functional reqs, roles & permissions, scope, KPIs, compliance, open questions |
| A2 | [System Architecture](02-architecture.md) | C4 diagrams, frontend/backend/AI/n8n/document/integration/security/deployment/reporting/error/scalability + per-agent specs |
| A3 | [Database Design](03-database.md) | ERD, normalized schema, indexes, RLS, audit, migrations, retention, Drizzle excerpts |
| A4 | [API Design](04-api.md) | REST/RPC endpoints, auth, webhooks, error model, OpenAPI excerpt |
| A5 | [n8n Workflow Design](05-workflows.md) | BPMN-style flows: triggers/steps/decisions/error paths/retry/escalation |
| A6 | [UI Wireframes](06-wireframes.md) | Client/Staff/Admin portals + compliance/document/task/comms dashboards |
| A7 | [Development Backlog](07-backlog.md) | Epics (M0–M14), stories, acceptance criteria, estimates, sequencing |

## Requirement traceability
Every requirement ID in A1 (`FR-`, `NFR-`, `CR-`, `BR-`) is referenced by the corresponding component (A2), table/policy (A3), endpoint (A4), workflow (A5), screen (A6), and backlog story (A7).

## Open questions to confirm before build
See **PRD §18** — chiefly: exact nature of GNS/LLP/GXY (legal form, AML supervisor, services), the v1 services catalogue & pricing model, authorisation-letter types, and whether a public intake form is in v1. Provider defaults (Amiqus / Dropbox Sign / Azure Document Intelligence) are confirmable later since each sits behind an interface.

## Next step
On approval, **Phase B begins at M0 — Foundation & infra** (monorepo scaffold, Supabase EU, Drizzle migrations, CI/CD, observability), delivered as production code + tests + deploy notes, then M1…M14 in sequence.
