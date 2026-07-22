# A4 — API Design

**Product:** Onboarding & Compliance Platform — GNS Associates
**Document:** A4 of 7 · depends on A1–A3 · Status: **Draft for approval**

---

## 1. API style & surfaces

| Surface | Use | Transport |
|---|---|---|
| **Server Actions** (Next.js) | First-party mutations from the app UI (forms, buttons) | RPC over HTTPS, typed |
| **REST route handlers** (`/api/v1/*`) | Programmatic access, n8n calls, integrations, mobile-future | JSON/HTTPS |
| **Inbound webhooks** (`/api/webhooks/*`) | Provider callbacks (e-sign, KYC, ledger, Graph) | JSON + HMAC |
| **Outbound events** | App → n8n via signed webhook (from outbox) | JSON + HMAC |

All surfaces converge on the **same service-layer use-cases** in `packages/core` (single validation/authz/audit path — A2 §5). REST is versioned under `/api/v1`.

---

## 2. Authentication & authorization

- **Staff:** Entra ID SSO → session cookie (Supabase-compatible JWT) carrying `role`, `entity_ids[]`.
- **Clients:** Supabase Auth → JWT carrying `client_id`.
- **Service-to-service (n8n, workers):** signed **service tokens** (short-lived JWT minted for a scoped role) + **HMAC** request signature + timestamp + nonce (replay protection).
- **Authorization:** every endpoint runs `authorize(actor, action, resource)` (RBAC) **and** relies on **RLS** as defence-in-depth. (`NFR-SEC-1`)

```
Authorization: Bearer <jwt>
X-Signature: sha256=<hmac>          # service & webhook calls
X-Timestamp: <unix>                 # replay window 300s
Idempotency-Key: <uuid>             # all POST/PATCH that cause side effects
```

---

## 3. Conventions

- **Versioning:** URI `/api/v1`; additive changes only within a version.
- **Pagination:** cursor-based `?cursor=&limit=` → `{ data, nextCursor }`.
- **Filtering/sorting:** `?status=&entityId=&sort=-createdAt`.
- **Idempotency:** required on side-effecting POST/PATCH via `Idempotency-Key`; stored to dedupe (maps to `events.idempotency_key`).
- **Validation:** Zod at the boundary; invalid → `422` with field errors.
- **Rate limiting:** per-principal token bucket; `429` + `Retry-After`.
- **Time:** ISO-8601 UTC.
- **Correlation:** every response carries `X-Request-Id` (and it appears in logs/traces).

---

## 4. Error model (`A2 §13`)

Consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable summary",
    "details": [{ "path": "services.0.serviceId", "issue": "required" }],
    "requestId": "req_01J..."
  }
}
```

| HTTP | code | when |
|---|---|---|
| 400 | `BAD_REQUEST` | malformed |
| 401 | `UNAUTHENTICATED` | missing/invalid auth |
| 403 | `FORBIDDEN` | RBAC/RLS denial |
| 404 | `NOT_FOUND` | absent or out-of-scope (don't leak existence) |
| 409 | `CONFLICT` / `ILLEGAL_TRANSITION` | state-machine guard, idempotency clash |
| 422 | `VALIDATION_ERROR` | Zod failure |
| 429 | `RATE_LIMITED` | throttled |
| 502/503 | `INTEGRATION_ERROR` | upstream provider failure (after retries) |
| 500 | `INTERNAL` | unexpected (correlation id only) |

---

## 5. Endpoint catalogue (`/api/v1`)

> Each maps to PRD FRs (shown in brackets). Standard CRUD verbs implied; only notable ones detailed.

### 5.1 Entities & config (Admin) — `BR-ENT-*`, `FR-ADM-*`
- `GET/POST/PATCH /entities`, `GET /entities/{id}` — manage GNS/LLP/GXY.
- `GET/POST/PATCH /services`, `/service-packages`.
- `GET/POST/PATCH /templates` (doc & email), `POST /templates/{id}/preview` (render with sample data).
- `GET/POST/PATCH /task-templates`, `/checklist-templates`.
- `GET/POST/PATCH /users`, `/roles`, `POST /users/{id}/roles`.
- `GET/POST /integrations/connections`, `POST /integrations/{provider}/oauth/start|callback`.

### 5.2 Clients & cases — `FR-LEAD-*`, `FR-WF-1`
- `POST /leads` — intake → creates `clients` + `onboarding_cases` (`FR-LEAD-1,2`). Body: entity, company/contact, services?, source. Idempotent.
- `GET /clients`, `GET /clients/{id}`, `PATCH /clients/{id}`.
- `GET /cases?status=&entityId=&assignedTo=&cursor=` — pipeline list.
- `GET /cases/{id}` — full case aggregate (status, steps, checklist, docs, compliance, reviews, comms).
- `POST /cases/{id}/transition` — guarded state change `{ to, reason }` → 409 `ILLEGAL_TRANSITION` if guard fails (`FR-WF-1`).
- `POST /cases/{id}/assign`, `POST /cases/{id}/hold|unhold|cancel`.

### 5.3 Services & pricing — `FR-SVC-*`, `FR-PRICE-*`
- `POST /cases/{id}/services` — select services (`FR-SVC-2`).
- `POST /cases/{id}/quote` — generate quote (`FR-PRICE-1`).
- `POST /cases/{id}/pricing/accept` — record agreement (`FR-PRICE-2`).

### 5.4 Company verification — `FR-CH-*`
- `POST /cases/{id}/companies-house/verify` — lookup + enrich (`FR-CH-1,2`); returns discrepancies (`FR-CH-3`).
- `GET /companies-house/search?q=` — typeahead.

### 5.5 AML / CDD / risk — `FR-AML-*`
- `POST /cases/{id}/kyc/initiate` — start IDV/AML for contacts (`FR-AML-1`).
- `GET /cases/{id}/kyc` — checks + statuses.
- `POST /cases/{id}/sanctions/screen` (`FR-AML-2`).
- `POST /cases/{id}/risk/assess` — runs Risk Assessor agent → draft (`FR-AML-3`).
- `POST /cases/{id}/risk/sign-off` — Partner/Compliance sign-off.
- `POST /cases/{id}/cdd/sign-off` — Compliance Officer completes CDD gate (`FR-AML-5`). 409 if evidence incomplete.

### 5.6 Documents — `FR-DOC-*`, `FR-COL-*`
- `POST /cases/{id}/documents/upload-url` — returns signed upload URL (`FR-COL-1`).
- `POST /cases/{id}/documents` — register uploaded doc (triggers classify/extract events).
- `GET /cases/{id}/documents`, `GET /documents/{id}/download-url`.
- `PATCH /documents/{id}/classification` — staff override (`FR-COL-6`).
- `GET /cases/{id}/checklist` — completeness view (`FR-COL-2,5`).
- `POST /cases/{id}/documents/generate` — generate auth/engagement letter `{ type, serviceIds }` (`FR-DOC-1,2`).
- `POST /generated-documents/{id}/send-for-signature` (`FR-DOC-4`).
- `GET /generated-documents/{id}` — status incl. e-sign.

### 5.7 Clearance & handover — `FR-CLR-*`
- `POST /cases/{id}/clearance/request` (`FR-CLR-1`).
- `POST /cases/{id}/handover/request` (`FR-CLR-2`).
- `GET /cases/{id}/clearance` — status + follow-ups.

### 5.8 Ledger & reviews — `FR-LED-*`
- `POST /cases/{id}/ledger/connect` — start Xero/QBO OAuth (`FR-LED-1`).
- `POST /cases/{id}/ledger/snapshot` — pull TB/ledgers/VAT/payroll (`FR-LED-2`).
- `POST /cases/{id}/reviews` — create review tasks for applicable areas (`FR-LED-3`).
- `POST /reviews/{id}/run-ai` — Ledger Reviewer agent → findings (`FR-LED-4`).
- `GET /reviews/{id}`, `PATCH /review-findings/{id}` (resolve).

### 5.9 Tasks — `FR-TASK-*`
- `GET /tasks?assignedTo=&status=`, `POST /tasks`, `PATCH /tasks/{id}`, `POST /tasks/{id}/reassign`.

### 5.10 Communications — `FR-COM-*`
- `POST /cases/{id}/messages` — send email (Graph→SMTP fallback) (`FR-COM-1`).
- `GET /cases/{id}/messages` — timeline.
- `GET /notifications`, `POST /notifications/{id}/read`.

### 5.11 AI agents & HITL — `FR-AI-*`
- `POST /agents/{agent}/run` — invoke (internal/service) `{ caseId, input }` (`FR-AI-1`).
- `GET /approvals?status=pending&role=` — HITL queue (`FR-AI-2`).
- `POST /approvals/{id}/approve|reject|edit` — human decision (`FR-AI-3`).
- `GET /agent-runs/{id}` — audit trace.

### 5.12 Reporting — `FR-RPT-*`
- `GET /reports/pipeline`, `/reports/sla`, `/reports/compliance`, `/reports/documents`, `/reports/agents`.
- `POST /cases/{id}/completion-report` — generate completion report PDF (`FR-RPT-1`).

---

## 6. Webhooks

### 6.1 Inbound (provider → app) — `/api/webhooks/{provider}`
- `esign` — envelope status (`delivered/completed/declined/...`) → updates `esign_envelopes`, advances case (`FR-DOC-6`).
- `kyc` — check results → updates `kyc_checks`/`sanctions_screenings`.
- `ledger` — Xero/QBO change notifications (optional).
- `graph` — mail delivery/bounce (optional).
All verify **HMAC + timestamp + provider event id** (idempotent); unverified → `401`; duplicates → `200` no-op.

### 6.2 Outbound (app → n8n) — signed event delivery
The outbox dispatcher POSTs domain events to n8n webhook URLs:
```json
{ "type": "case.engagement_signed", "caseId": "...", "entityId": "...",
  "occurredAt": "...", "data": { ... }, "idempotencyKey": "..." }
```
Event types: `lead.created`, `pricing.agreed`, `company.verified`, `kyc.completed`, `risk.assessed`, `document.generated`, `esign.sent`, `esign.completed`, `clearance.requested`, `clearance.no_response`, `documents.incomplete`, `ledger.connected`, `review.created`, `cdd.signed_off`, `case.completed`, `task.overdue`. (Consumed by A5 workflows.)

---

## 7. OpenAPI (excerpt)

```yaml
openapi: 3.1.0
info: { title: Onboarding & Compliance API, version: 1.0.0 }
servers: [{ url: https://app.example.eu/api/v1 }]
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    Error:
      type: object
      properties:
        error:
          type: object
          required: [code, message, requestId]
          properties:
            code: { type: string }
            message: { type: string }
            requestId: { type: string }
            details: { type: array, items: { type: object } }
paths:
  /cases/{id}/transition:
    post:
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: Idempotency-Key, in: header, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [to]
              properties:
                to: { type: string }
                reason: { type: string }
      responses:
        "200": { description: Transitioned }
        "409":
          description: Illegal transition
          content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
        "403": { $ref: "#/components/responses/Forbidden" }
```

The full OpenAPI spec is generated from Zod schemas (`zod-to-openapi`) and published at `/api/v1/openapi.json` + Swagger UI in non-prod. (`NFR-MAIN-1`)

---

## 8. Cross-cutting

- **Idempotency store** dedupes retried POSTs (n8n/webhooks safe to replay). (`NFR-REL-1`)
- **Rate limits** per principal/IP; stricter on public intake.
- **Audit**: every mutating endpoint produces an `audit_logs` entry via the service layer. (`NFR-AUD-1`)
- **PII**: request/response logging scrubs PII; tokens never logged. (`NFR-PRIV-1`)
- **Pagination/perf**: list endpoints back read-optimised views (A2 §12).

---

## ✅ Approval gate
**This is Deliverable A4.** Proceeding to **A5 — n8n Workflow Design**.
