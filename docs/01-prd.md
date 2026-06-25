# A1 — Product Requirements Document (PRD)

**Product:** AI-Powered Client Onboarding & Compliance Platform
**Client:** GNS Associates (UK accountancy practice; entities **GNS**, **LLP**, **GXY**)
**Document:** A1 of the design blueprint (PRD → Architecture → DB → API → n8n → Wireframes → Backlog)

| Field | Value |
|---|---|
| Version | 0.1 (Draft for approval) |
| Date | 2026-06-24 |
| Author | Lead Solution Architect |
| Status | **Awaiting sign-off** (gate to Deliverable A2) |
| Audience | Practice partners, compliance officer, product owner, dev team |

> **How to read this document.** Requirements are uniquely identified (`BR-`, `FR-`, `NFR-`, `CR-`) so every later artifact (architecture, schema, API, tests) can trace back to a requirement. Anything not yet decided is captured in §18 *Open Questions* rather than silently assumed. Sign-off on this PRD freezes scope for the blueprint phase; changes after sign-off go through §19 change control.

---

## 1. Executive summary

GNS Associates onboards new accounting clients through a manual, email-and-spreadsheet process that is slow, inconsistent across its three trading entities, and hard to evidence for AML supervision. This platform digitises and automates the **entire new-client lifecycle** — from enquiry and service/pricing agreement, through company verification, AML/CDD, authorisation and engagement letters, e-signature, professional clearance and previous-accountant handover, to VAT/PAYE/CIS/accounts/trial-balance reviews, document collection, compliance sign-off, task creation and a completion report.

The system is a **standalone system-of-record**. It uses **AI agents** (Claude) to classify documents, detect missing information, draft communications, assess risk and assist compliance and ledger review — always with **human sign-off on compliance-critical decisions**. **n8n** handles scheduled and long-running automation (chasers, retries, re-checks). The platform is **multi-entity white-label**: each of GNS/LLP/GXY carries its own branding, templates, bank details, signatory and AML supervisor, and the system **automatically selects the correct documents and workflow** from the chosen entity + services.

The outcome: faster onboarding (target **≤ 10 working days median**), consistent and auditable compliance, lower staff effort per client, and a defensible MLR 2017 / UK GDPR posture.

---

## 2. Business context & problem statement

### 2.1 Current state (pain points)
- **Manual, fragmented onboarding.** Client data re-keyed across email, Word templates, Excel trackers and the accounting tools. No single source of truth.
- **Inconsistent compliance.** AML/CDD and risk assessment are done ad hoc; evidence is scattered, making supervisory review and audits painful.
- **Slow, leaky handovers.** Professional clearance and previous-accountant chasing rely on staff memory; items stall silently.
- **Entity confusion.** Staff manually pick the right letterhead, engagement terms, bank details and signatory per entity — error-prone.
- **No automation.** Chasing unsigned letters and missing documents is manual; no SLA visibility; partners lack a real-time onboarding pipeline view.
- **Underused data.** Ledger data in Xero/QuickBooks isn't systematically reviewed at onboarding to spot VAT/PAYE/CIS/accounts issues early.

### 2.2 Desired state
A guided, automated, auditable onboarding pipeline where the **right work happens automatically in the right order for the right entity**, AI does the repetitive cognitive work, staff approve what matters, and partners see live status and compliance health.

### 2.3 Business drivers
- Reduce onboarding cycle time and cost-to-serve.
- Strengthen AML/regulatory compliance and auditability.
- Standardise quality across entities and staff.
- Improve client experience (clear, branded, low-friction onboarding).
- Create a scalable foundation for future practice growth and additional services.

---

## 3. Goals & objectives

| ID | Objective | Measure (see §5) |
|---|---|---|
| G1 | Cut onboarding cycle time | Median time-to-complete |
| G2 | Make compliance consistent & auditable | % cases with complete CDD evidence; audit pass rate |
| G3 | Reduce manual staff effort | Staff hours per onboarded client |
| G4 | Eliminate entity/template errors | Document generation error rate |
| G5 | Improve client experience | Client onboarding CSAT; portal completion rate |
| G6 | Increase pipeline visibility | Partner dashboard adoption; stalled-case detection time |
| G7 | Early issue detection via AI reviews | # material findings surfaced pre-completion |

### 3.1 Non-goals (explicitly out of scope for v1)
- Full practice management (time & billing, payroll bureau processing, tax return preparation/filing). The platform **creates** review tasks but does not **perform** ongoing compliance work.
- Replacing Xero/QuickBooks as the bookkeeping ledger.
- Client accounting/bookkeeping execution, statutory filing, or tax computations.
- Marketing/lead generation funnels (enquiry intake is supported; lead nurturing is not).
- Mobile native apps (responsive web only in v1).

---

## 4. Scope

### 4.1 In scope (v1)
1. Multi-entity configuration (GNS/LLP/GXY) with per-entity branding, templates, bank, signatory, AML supervisor.
2. Lead/enquiry intake → service selection → pricing/quote → agreement.
3. Companies House company verification & data enrichment.
4. AML/CDD: KYC provider integration, ID verification, sanctions/PEP screening, risk assessment, compliance sign-off.
5. Automated generation of **authorisation letters** and **engagement letters** (entity- and service-driven).
6. E-signature request, tracking and chasing (provider-agnostic).
7. Professional clearance request + previous-accountant communication & follow-up.
8. Bookkeeping handover coordination.
9. Document collection portal with AI classification, extraction, completeness validation and missing-info detection.
10. Accounting integrations (Xero deep read first; QuickBooks second) for ledger-based review.
11. AI-assisted reviews producing **review tasks**: bookkeeping, VAT, PAYE, CIS, accounts, trial balance.
12. Task management and assignment.
13. Communication centre (email via Microsoft Graph + SMTP fallback; in-app notifications).
14. Onboarding completion report.
15. Portals: client, staff, admin; dashboards: compliance, document centre, tasks, communications.
16. Audit logging, reporting, retention.

### 4.2 Out of scope (v1) — see §3.1.

---

## 5. Success metrics (KPIs)

| KPI | Baseline (assumed) | Target (v1) | Source |
|---|---|---|---|
| Median onboarding cycle time | ~25 working days | **≤ 10 working days** | `case_transitions` |
| Staff hours per onboarded client | ~6–8 hrs | **≤ 3 hrs** | task time / sampling |
| Cases with complete CDD evidence at completion | inconsistent | **100%** (hard gate) | compliance module |
| Document classification accuracy (auto-accepted) | n/a | **≥ 95%** precision @ ≥0.85 confidence | agent eval set |
| Missing-info detection recall | n/a | **≥ 90%** | agent eval set |
| Engagement letters sent with correct entity template | manual | **100%** | generation logs |
| Median time to chase unsigned doc → signed | unmeasured | **−40%** vs baseline | esign events |
| Stalled-case detection latency | days | **≤ 1 day** (automated) | n8n monitors |
| Client onboarding CSAT | n/a | **≥ 4.3 / 5** | post-onboarding survey |
| Audit/supervisory review pass | variable | **no critical findings** | audit logs |

> Baselines marked "assumed/unmeasured" to be confirmed with the practice during A1 sign-off; targets adjust accordingly.

---

## 6. Personas & stakeholders

| Persona | Goals | Pain today |
|---|---|---|
| **Prospective/New client** | Sign up, understand price, sign letters, upload docs with minimal friction | Confusing back-and-forth emails, unclear status |
| **Onboarding Staff** | Move clients through onboarding quickly and correctly | Manual chasing, template hunting, re-keying |
| **Reviewer (VAT/PAYE/CIS/Accounts)** | Spot issues in client books early | No structured handover or ledger insight |
| **Compliance Officer / MLRO** | Ensure CDD, risk, sanctions done & evidenced | Scattered evidence, no single audit trail |
| **Manager** | Allocate work, hit SLAs, see pipeline | No real-time view; bottlenecks invisible |
| **Partner** | Grow practice, manage risk, sign off high-risk | Limited visibility, inconsistent quality |
| **Admin** | Configure entities, services, templates, users | No central configuration |
| **Previous accountant (external)** | Respond to clearance/handover requests | Inconsistent, manual outreach |

---

## 7. User roles & permissions

### 7.1 Roles
`Admin`, `Partner`, `Manager`, `Onboarding Staff`, `Reviewer`, `Compliance Officer (MLRO)`, `Client`, `System/Service` (n8n & AI agents, non-interactive).

### 7.2 Permission matrix (capability × role)

Legend: ✔ full · ◑ scoped/limited · ✱ approve/sign-off only · — none

| Capability | Admin | Partner | Manager | Onboarding | Reviewer | Compliance | Client |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Configure entities/templates/services | ✔ | ◑ | — | — | — | — | — |
| Manage users & roles | ✔ | ◑ | — | — | — | — | — |
| Create/manage onboarding case | ✔ | ✔ | ✔ | ✔ | — | ◑ | — |
| View all cases (all entities) | ✔ | ✔ | ◑ | ◑ | ◑ | ✔ | — |
| View own/assigned cases | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ◑(own) |
| Generate auth/engagement letters | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Send e-sign request | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Run/trigger AI agents | ✔ | ✔ | ✔ | ✔ | ◑ | ◑ | — |
| Approve AI compliance/risk output | — | ✔ | ◑ | — | — | ✔ | — |
| Approve client-facing AI comms (first send) | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Perform/sign-off CDD & risk | — | ✱ | — | ◑ | — | ✔ | — |
| Conduct VAT/PAYE/CIS/accounts/TB review | ✔ | ✔ | ✔ | — | ✔ | — | — |
| Upload documents | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔(own) |
| View documents | ✔ | ✔ | ◑ | ◑ | ◑ | ✔ | ◑(own) |
| View audit log | ✔ | ✔ | ◑ | — | — | ✔ | — |
| Manage retention/purge | ✔ | ◑ | — | — | — | ✔ | — |
| Complete onboarding (final sign-off) | ✔ | ✔ | ✔ | — | — | ✱ | — |

> RLS enforces **entity scoping**: non-Admin staff see only entities they are assigned to; clients see only their own case/documents. Full enforcement detail in A2/A3.

---

## 8. Multi-entity (white-label) requirements

| ID | Requirement |
|---|---|
| BR-ENT-1 | The platform shall support multiple practice entities (initially GNS, LLP, GXY) and be extensible to add more without code change. |
| BR-ENT-2 | Each entity shall hold its own: legal name, trading name, logo/branding, address, contact details, **bank details**, **authorised signatory**, **AML supervisor/registration**, VAT/registration numbers, and **template set** (authorisation letter, engagement letter, email templates). |
| BR-ENT-3 | On case creation the user selects the **entity**; the platform shall **automatically determine** the applicable documents, terms, and workflow variant from entity + selected services. |
| BR-ENT-4 | Generated documents shall always reflect the selected entity's branding, signatory and bank details — never mixed. |
| BR-ENT-5 | Reporting and dashboards shall be filterable and securable **per entity**. |
| BR-ENT-6 | Each entity may define service-specific engagement clauses (e.g. VAT vs payroll) combined into the final engagement letter. |

---

## 9. Functional requirements

Grouped by capability. Each `FR` is testable and maps to later modules (M0–M14).

### 9.1 Lead intake, services & pricing
- **FR-LEAD-1** Capture an enquiry/lead (client + company details, contact, source) via staff entry or a public intake form.
- **FR-LEAD-2** Create a **client record** and an **onboarding case** automatically from an accepted lead.
- **FR-SVC-1** Maintain a catalogue of services (bookkeeping, VAT, PAYE, CIS, year-end accounts, payroll, self-assessment, corporation tax, confirmation statement, etc.).
- **FR-SVC-2** Allow selection of one or more services per client, with service-specific parameters (e.g. VAT scheme, payroll frequency).
- **FR-PRICE-1** Generate a quote/pricing proposal from selected services and a configurable pricing model (fixed, tiered, custom).
- **FR-PRICE-2** Record client acceptance of pricing (a **pricing agreement**) with timestamp and version, as a prerequisite to engagement.

### 9.2 Company verification
- **FR-CH-1** Verify the client's company via **Companies House API** (company number/name lookup).
- **FR-CH-2** Enrich the client record with registered office, SIC codes, incorporation date, officers/PSCs, and filing status.
- **FR-CH-3** Flag discrepancies between client-entered and Companies House data for staff review.
- **FR-CH-4** Re-check company status on a schedule (n8n) during onboarding and flag dissolution/strike-off risk.

### 9.3 AML / CDD / risk (compliance)
- **FR-AML-1** Initiate KYC/ID verification via the configured **KYC provider** for relevant individuals (directors/PSCs/signatories).
- **FR-AML-2** Run **sanctions & PEP screening**; store results and matches.
- **FR-AML-3** Produce a structured **risk assessment** (sector, geography, structure, PEP, source of funds) with a risk rating (Low/Medium/High).
- **FR-AML-4** Maintain a **CDD record** per client capturing evidence, checks, outcomes and reviewer.
- **FR-AML-5** **Hard gate:** onboarding cannot be marked complete without a Compliance Officer sign-off of CDD + risk. High-risk requires Partner sign-off.
- **FR-AML-6** Re-screen on a schedule and on material changes; record EDD (enhanced due diligence) where required.

### 9.4 Document generation & e-signature
- **FR-DOC-1** Generate **authorisation letters** (e.g. agent authorisation / 64-8 equivalents, bank/data authority) from entity + service templates with merged client data.
- **FR-DOC-2** Generate **engagement letters** assembling entity terms + service-specific schedules.
- **FR-DOC-3** Render generated documents to PDF, version them, and store immutably.
- **FR-DOC-4** Send documents for **e-signature** via the provider-agnostic e-sign interface; track envelope status.
- **FR-DOC-5** **Chase unsigned** documents automatically on a configurable cadence; escalate to assigned staff after N attempts.
- **FR-DOC-6** On signature completion, store the signed PDF + audit certificate and advance the case state.

### 9.5 Professional clearance & previous-accountant handover
- **FR-CLR-1** Generate and send a **professional clearance** request to the previous accountant.
- **FR-CLR-2** Generate **handover / records request** (bookkeeping records, trial balance, tax position, payroll data).
- **FR-CLR-3** Track responses; **follow up automatically** on non-response with escalation.
- **FR-CLR-4** Log all clearance communications against the case for audit.

### 9.6 Document collection, classification & validation
- **FR-COL-1** Provide a client document upload portal (drag/drop, mobile-friendly, resumable).
- **FR-COL-2** Generate an **onboarding checklist** of required documents from entity + services; show progress to client and staff.
- **FR-COL-3** **AI-classify** each uploaded document (ID, proof of address, bank statement, VAT return, payroll report, prior accounts, TB, etc.).
- **FR-COL-4** **Extract** key fields via OCR/Document AI (names, dates, amounts, periods, identifiers).
- **FR-COL-5** **Validate completeness** against the checklist; **detect missing information** and notify the responsible party.
- **FR-COL-6** Allow staff to correct/override classification and extraction; corrections feed quality metrics.

### 9.7 Accounting integration & ledger review
- **FR-LED-1** Connect the client's **Xero** organisation (OAuth) and later **QuickBooks**; store encrypted tokens.
- **FR-LED-2** Pull trial balance, chart of accounts, ledgers, VAT, and payroll data where available; snapshot for review.
- **FR-LED-3** Generate **review tasks** per applicable service: bookkeeping, VAT, PAYE, CIS, accounts, trial balance.
- **FR-LED-4** AI-assist each review with findings (anomalies, missing data, reconciliation issues); findings are **staff-reviewed**.

### 9.8 Tasks & workflow
- **FR-WF-1** Drive each case through the onboarding **state machine** (see §11), recording every transition with actor, timestamp and reason.
- **FR-TASK-1** Create tasks from templates automatically at the right states; assign by role/round-robin/rules.
- **FR-TASK-2** Support task status, due dates, SLA, comments, attachments, reassignment.
- **FR-TASK-3** Escalate overdue/blocked tasks to managers/partners.

### 9.9 Communication
- **FR-COM-1** Send email via **Microsoft Graph**; fall back to **SMTP** on failure; log all messages to the case.
- **FR-COM-2** Use entity-branded templates; AI-drafted messages require approval before first client send.
- **FR-COM-3** Provide in-app notifications and a per-case communication timeline.

### 9.10 Completion & reporting
- **FR-RPT-1** Generate an **onboarding completion report** (services, entity, documents, CDD/risk outcome, reviews, open items) on completion.
- **FR-RPT-2** Provide operational reports: pipeline, SLA, bottlenecks, compliance status, document completeness, AI agent performance.
- **FR-RPT-3** Provide dashboards (compliance, documents, tasks, communications) per §13 of the brief.

### 9.11 AI agents (functional)
- **FR-AI-1** Provide 8 agents (orchestrator, document classifier, missing-info detector, compliance reviewer, risk assessor, client communicator, previous-accountant communicator, bookkeeping/ledger reviewer).
- **FR-AI-2** Every agent returns **structured output + a confidence score**; outputs below threshold or in conflict with validators route to a **human approval (HITL) queue**.
- **FR-AI-3** Compliance and risk decisions are **always** advisory and require human sign-off (never auto-applied).
- **FR-AI-4** All agent runs are logged (inputs, outputs, model, tokens, confidence, approver) for audit and evaluation.

### 9.12 Administration & configuration
- **FR-ADM-1** Manage entities, services, pricing models, templates (documents & emails), checklists, task templates, chaser cadences, SLA, and confidence thresholds via admin UI.
- **FR-ADM-2** Manage users, roles and entity assignments.
- **FR-ADM-3** Manage integration connections and credentials securely.

---

## 10. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-PERF-1 | Performance | Interactive pages P95 < 2.5s; API P95 < 500ms (excl. external calls). Long-running/external operations run async via queue/n8n with status feedback. |
| NFR-SCAL-1 | Scalability | Support ≥ 5,000 active clients and ≥ 200 concurrent staff/client sessions in v1; horizontally scalable web tier; stateless app servers. |
| NFR-AVAIL-1 | Availability | 99.9% monthly target for the app; graceful degradation when an external provider is down (queue & retry, never lose data). |
| NFR-SEC-1 | Security | OWASP ASVS L2 baseline; all traffic TLS 1.2+; least-privilege RBAC + RLS; encrypted secrets; no PII in logs. (Detail in A2.) |
| NFR-PRIV-1 | Privacy / GDPR | UK/EU data residency; lawful basis & retention enforced; DSAR/erasure supported; AI no-training DPA; PII minimisation in prompts. |
| NFR-COMP-1 | Regulatory | Evidence and audit trail sufficient for MLR 2017 supervisory review and ICAEW/ACCA expectations. |
| NFR-AUD-1 | Auditability | Append-only audit log of all state changes, document events, compliance decisions and AI approvals; tamper-evident. |
| NFR-REL-1 | Reliability | Idempotent operations and an outbox/event model; all external calls retried with backoff and dead-lettered; no duplicate sends. |
| NFR-OBS-1 | Observability | Centralised structured logs, metrics, traces, error tracking (Sentry), and per-workflow run visibility. |
| NFR-USE-1 | Usability/A11y | WCAG 2.1 AA for client-facing portal; responsive; clear status at every step. |
| NFR-I18N-1 | Localisation | UK English, GBP, UK date formats; £ and DD/MM/YYYY; architecture not blocked from future locales. |
| NFR-MAIN-1 | Maintainability | Typed end-to-end (TS + Zod), modular packages, ≥80% unit coverage on core domain logic, documented APIs. |
| NFR-PORT-1 | Portability | External providers (KYC, e-sign, OCR, mailer, ledger) behind interfaces/adapters; swappable without core changes. |
| NFR-DR-1 | Backup/DR | Automated daily backups, PITR where available; documented RPO ≤ 24h, RTO ≤ 8h (to confirm). |
| NFR-COST-1 | Cost control | AI model tiering (Haiku for cheap passes, Opus for complex reasoning); token/usage logging and budget alerts. |

---

## 11. Onboarding lifecycle (business view)

The case advances through these primary states (authoritative state machine; full diagram + guards in A5):

`lead → service_selection → pricing_agreed → company_verified → kyc_cdd → risk_assessed → auth_letter_signed → engagement_signed → clearance_requested → handover → ledger_connected → reviews_in_progress → docs_complete → compliance_passed → tasks_created → completed`

Side-states: `on_hold`, `blocked` (missing info / failed check), `rejected` (declined client / failed AML), `cancelled`.

**Key business rules / gates:**
- Engagement letter cannot be sent before pricing is agreed and the company is verified.
- Onboarding cannot reach `completed` without: signed engagement letter, Compliance Officer CDD+risk sign-off, required documents complete, and all mandatory review tasks created.
- High-risk clients require Partner sign-off before `completed`.
- Each entity may enable/disable optional steps (e.g. clearance not needed for a brand-new company with no prior accountant).

---

## 12. Integration requirements

| ID | Integration | Purpose | Notes |
|---|---|---|---|
| CR-INT-1 | **Companies House API** | Company verification & enrichment | Public data; test environment for dev |
| CR-INT-2 | **Xero API** | Deep ledger read (TB, ledgers, VAT, payroll) | First-class; demo org for dev |
| CR-INT-3 | **QuickBooks API** | Ledger read | Second; same adapter contract |
| CR-INT-4 | **Microsoft Graph** | Staff SSO + email send (+ optionally files/calendar) | Primary mailer; Entra app registration |
| CR-INT-5 | **SMTP** | Email fallback | Provider-agnostic |
| CR-INT-6 | **E-signature** | Send/track signatures | Provider-agnostic interface; default eIDAS adapter |
| CR-INT-7 | **KYC/AML provider** | ID verification, sanctions/PEP, AML | UK provider behind interface |
| CR-INT-8 | **Document AI / OCR** | Extraction & classification assist | EU region |
| CR-INT-9 | **Claude (Anthropic API)** | AI agents | Direct API, EU DPA, no-training |

All integrations: encrypted credentials, retry/backoff, circuit-breaking, sandbox in non-prod, and health checks.

---

## 13. Data & retention requirements

| ID | Requirement |
|---|---|
| CR-DATA-1 | All personal/financial data stored in **UK/EU** region. |
| CR-DATA-2 | Default retention: **current year + 6 years** after relationship end (ICAEW/HMRC norm); per-record-type overrides configurable. |
| CR-DATA-3 | Soft-delete with scheduled hard-purge after retention; purge is logged. |
| CR-DATA-4 | Support **DSAR** export and **right-to-erasure** (subject to legal-hold/retention obligations). |
| CR-DATA-5 | Documents stored with versioning, integrity hashing, and signed-URL access only. |
| CR-DATA-6 | Audit logs retained for at least the regulatory minimum and protected from modification. |

---

## 14. Assumptions

- The practice has (or will provision) accounts/credentials for Companies House, Xero, QuickBooks, Microsoft 365/Entra, the chosen KYC and e-sign providers, Anthropic, and Azure (for Document AI).
- Each entity's branding assets, bank details, signatory and template wording will be supplied as content inputs (the platform provides the engine, not the legal wording).
- Email sending domains/SPF/DKIM/DMARC for each entity are (or will be) configured.
- A single shared Postgres database with entity scoping + RLS is acceptable (vs separate databases).
- The practice's legal/compliance team approves final letter and CDD content; the platform automates assembly and workflow, not legal advice.

## 15. Dependencies
- Vendor sandbox access for development and contract testing.
- Entity-specific legal content (engagement terms, authorisation wording).
- Decision on specific KYC and e-sign providers (defaults proposed; see §18).
- DPA/contracts in place with Anthropic and other processors.

## 16. Constraints
- Tech stack fixed: Next.js, TypeScript, PostgreSQL/Supabase, n8n, Claude, Microsoft Graph, e-sign, Vercel.
- UK/EU data residency is mandatory.
- Compliance-critical AI outputs must be human-approved (no full automation of CDD/risk decisions).

## 17. Risks (initial register)

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| External provider outages (KYC/e-sign/ledger) | Onboarding stalls | Med | Queue + retry + status visibility; provider abstraction |
| AI misclassification / hallucination | Wrong action, compliance error | Med | Confidence thresholds + validators + HITL; never auto-apply compliance decisions |
| PII leakage to AI or logs | Regulatory breach | Low/Med | PII minimisation, no-training DPA, redaction, no PII in logs |
| Scope creep into full practice management | Delays v1 | Med | Strict §3.1 non-goals; change control |
| Entity template misconfiguration | Wrong legal docs sent | Low | Entity-bound generation + preview + tests; 100% template-match KPI |
| Data residency misconfiguration | GDPR breach | Low | EU regions enforced in infra config + reviewed in A2/M0 |

## 18. Open questions / assumptions to confirm (before/at sign-off)

1. **KYC/AML provider** — confirm Amiqus (default) vs Credas / Onfido / ID-Pal; affects FR-AML-* and CR-INT-7.
2. **E-sign provider** — confirm default adapter (Dropbox Sign vs Yousign vs SignWell); DocuSign as alternative.
3. **Document AI/OCR** — confirm Azure Document Intelligence (default) vs AWS Textract / Google Document AI.
4. **Authorisation letter types** — exact set the practice uses (e.g. HMRC agent authorisation/64-8, bank mandate, data authority) per service.
5. **Entity specifics** — what GNS, LLP, GXY each are (legal form, AML supervisor, services offered) + branding/template/bank inputs.
6. **Services catalogue** — confirm the full v1 list and any service-specific parameters.
7. **Pricing model** — fixed/tiered/custom; is automated quoting needed in v1 or staff-entered price?
8. **Chaser cadence & SLAs** — confirm default chase intervals and escalation thresholds.
9. **Retention specifics** — confirm 6+current years and any per-document-type exceptions.
10. **RPO/RTO** targets and backup expectations.
11. **Public intake form** — needed in v1, or staff-created cases only?
12. **Baselines** for KPIs (§5) to set realistic targets.

## 19. Change control
After sign-off, scope changes are logged, impact-assessed (cost/time/risk), and approved by the product owner before incorporation. Material changes may re-open affected blueprint artifacts.

## 20. Acceptance criteria for this PRD (Definition of Ready for A2)
- Roles & permission matrix (§7) accepted.
- In/out-of-scope (§4, §3.1) accepted.
- KPIs & targets (§5) accepted (or baselines provided).
- Open questions (§18) answered or explicitly deferred with owners.
- No unresolved conflicts between functional requirements and constraints.

## 21. Glossary
- **CDD** — Customer Due Diligence (AML). **EDD** — Enhanced Due Diligence.
- **MLR 2017** — UK Money Laundering Regulations 2017. **MLRO** — Money Laundering Reporting Officer.
- **PEP** — Politically Exposed Person. **PSC** — Person of Significant Control.
- **Professional clearance** — request to a client's previous accountant confirming no professional reason not to act.
- **HITL** — Human-in-the-loop approval. **RLS** — Row-Level Security.
- **TB** — Trial Balance. **eIDAS** — EU electronic identification & trust services regulation.
- **Entity** — one of the practice's trading entities (GNS/LLP/GXY).

---

### Traceability note
Every `FR`/`NFR`/`CR`/`BR` ID here will be referenced by the corresponding component in A2 (architecture), table/policy in A3 (database), endpoint in A4 (API), workflow in A5 (n8n), screen in A6 (wireframes), and task in A7 (backlog) — giving full requirement-to-build traceability.

---

## ✅ Approval gate

**This is Deliverable A1.** On your approval (and answers to §18 where you have them), I will proceed to **A2 — System Architecture**. If you'd like changes to scope, roles, KPIs, or requirements, tell me now and I'll revise A1 before moving on.
