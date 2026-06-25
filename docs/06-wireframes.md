# A6 — UI Wireframes

**Product:** Onboarding & Compliance Platform — GNS Associates
**Document:** A6 of 7 · depends on A1–A5 · Status: **Draft for approval**

> Low-fidelity wireframes (layout + content + interactions). Visual design uses Tailwind + shadcn/ui with **per-entity theming** (logo/colours from the selected entity — `BR-ENT-4`). Client portal targets **WCAG 2.1 AA** (`NFR-USE-1`).

---

## 1. Design system & global patterns

- **Layout:** left nav (staff/admin) or top-stepper (client); content max-width 1200px; responsive down to mobile.
- **Components:** Button, Card, Table (sortable, cursor-paginated), Stepper, Badge (status colours), Drawer, Modal/Dialog, Toast, FileDropzone, Timeline, EmptyState, ConfirmDialog (destructive).
- **Status colours:** grey=pending, blue=in-progress, amber=blocked/needs-action, green=done, red=rejected/failed.
- **Entity switcher:** staff with multi-entity access get an entity selector in the top bar; all data filters by it (RLS-backed).
- **Realtime:** case/task/document statuses update live (Supabase Realtime).

---

## 2. Client Portal `(client)` — `FR-COL-1`, `FR-DOC-4`, `FR-COM-3`

Audience: the prospective/new client. Simple, guided, branded by their entity. Top progress stepper, minimal nav.

### 2.1 Client dashboard / status
```
┌───────────────────────────────────────────────────────────────┐
│ [GNS logo]                         Welcome, Jane ▾   🔔  Help   │
├───────────────────────────────────────────────────────────────┤
│  Your onboarding                                  Step 4 of 8  │
│  ●──●──●──●──○──○──○──○                                         │
│  Sign  Pricing  Verify  KYC  Docs  Sign  Review  Done          │
├───────────────────────────────────────────────────────────────┤
│  ⚠  Action needed (2)                                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✍  Sign your engagement letter            [Review & Sign]│  │
│  │ 📄  Upload last year's accounts            [Upload]       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  Recently completed                                            │
│  ✓ Identity verified   ✓ Pricing accepted                     │
│                                                                │
│  Need help?  Message your accountant  [Open messages]          │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Document checklist & upload (`FR-COL-2`, `FR-COL-5`)
```
┌───────────────────────────────────────────────────────────────┐
│  Documents                                  3 of 7 complete    │
├───────────────────────────────────────────────────────────────┤
│  Required                                                      │
│  ✓ Photo ID (passport)                       Verified         │
│  ✓ Proof of address                          Verified         │
│  ⏳ Last year's accounts                      [⬆ Upload]       │
│  ⏳ Bank statements (3 months)                [⬆ Upload]       │
│  ⏳ VAT registration certificate              [⬆ Upload]       │
│                                                                │
│  ┌───────────────  Drag & drop files here  ───────────────┐   │
│  │            or click to browse (PDF, JPG, PNG)          │   │
│  └────────────────────────────────────────────────────────┘   │
│  Uploads are encrypted. We'll tell you if anything's missing.  │
└───────────────────────────────────────────────────────────────┘
```
Interactions: resumable upload, instant "classifying…" → ✓ classified/needs review; missing-info banner if gaps.

### 2.3 Review & e-sign (`FR-DOC-4`)
```
┌───────────────────────────────────────────────────────────────┐
│  Engagement Letter — GNS Associates                            │
│  ┌───────────────── PDF preview ─────────────────┐  Signers    │
│  │  ...engagement terms, services, fees...       │  ☐ You      │
│  │                                               │  ☑ GNS (pre)│
│  └───────────────────────────────────────────────┘             │
│  By signing you agree to the terms.   [Decline]  [Sign now ▶]  │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Staff Portal `(staff)` — onboarding, reviews, compliance

### 3.1 Case pipeline (list)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ Onboarding ▸ Cases       Entity: [All ▾]   [+ New client]   🔔  ME  │
├──────────────────────────────────────────────────────────────────────┤
│ Filters: Status[▾] Assignee[▾] Risk[▾] SLA[▾]            🔍 search     │
├──────────────────────────────────────────────────────────────────────┤
│ Ref         Client            Entity Status         Risk SLA   Owner  │
│ GNS-26-0007 Acme Ltd          GNS    Engagement ●   Med  ⏰ 2d  JS     │
│ LLP-26-0031 Beta Trading LLP  LLP    KYC/CDD    ▲   High ⏰ today AK   │
│ GXY-26-0012 Gamma Ltd         GXY    Docs       ▲   Low  ⏰ 4d  —      │
│ GNS-26-0009 Delta Sole Trader GNS    Completed ✓    Low  —     JS     │
│                                            ‹ prev   next ›             │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Case detail (the workspace)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Cases   GNS-26-0007 · Acme Ltd · GNS            Status: Engagement ●│
│ [Advance ▸] [Assign] [Hold] [Message] [Generate doc]      Risk: Med   │
├───────────────┬──────────────────────────────────────────────────────┤
│ Steps         │  Overview                                            │
│ ✓ Service     │  Services: Bookkeeping, VAT, Year-end accounts       │
│ ✓ Pricing     │  Company: 01234567 ✓ verified (Companies House)      │
│ ✓ Verify      │  Contacts: Jane Doe (director, signatory)            │
│ ✓ KYC/CDD     │  ┌── Compliance ───────────────────────────────────┐│
│ ● Engagement  │  │ KYC ✓  Sanctions ✓  Risk: Med  CDD: ☐ sign-off ││
│ ○ Clearance   │  └──────────────────────────────────────────────────┘│
│ ○ Reviews     │  ┌── Documents (5/7) ──────────────────────────────┐ │
│ ○ Docs        │  │ ✓ ID  ✓ PoA  ⏳ Accounts  ⏳ Bank  ...           │ │
│ ○ Complete    │  └──────────────────────────────────────────────────┘│
│               │  ┌── e-sign ───────────────────────────────────────┐ │
│  Activity ▾   │  │ Engagement letter: Sent · chased 1× · due 3d     │ │
│  (timeline)   │  └──────────────────────────────────────────────────┘│
└───────────────┴──────────────────────────────────────────────────────┘
```
The **[Advance ▸]** button calls the guarded transition; disabled with tooltip if a gate is unmet (e.g. "CDD sign-off required").

### 3.3 Review workspace (VAT/PAYE/CIS/accounts/TB) (`FR-LED-4`)
```
┌──────────────────────────────────────────────────────────────────────┐
│ VAT Review · Acme Ltd            Ledger: Xero (snapshot 24 Jun)        │
├───────────────────────────────────┬──────────────────────────────────┤
│ Findings (AI-assisted)            │  Evidence                         │
│ ▲ High  VAT on exempt supplies?   │  TB line 4200 · £3,210            │
│ ● Med   2 unreconciled items      │  Bank vs ledger diff              │
│ ○ Info  Scheme: Flat Rate         │                                   │
│ [Add finding] [Mark reviewed] [Create task]                           │
└───────────────────────────────────┴──────────────────────────────────┘
```

---

## 4. Admin Portal `(admin)` — `FR-ADM-*`, `BR-ENT-*`

### 4.1 Entities
```
┌───────────────────────────────────────────────────────────────┐
│ Admin ▸ Entities                                  [+ Add]      │
│ ┌─────────┬──────────────┬───────────┬──────────┬───────────┐ │
│ │ Code    │ Legal name   │ Signatory │ AML supv │ Templates │ │
│ │ GNS     │ GNS Assoc Ltd│ A. Khan   │ ICAEW    │ 6   [Edit]│ │
│ │ LLP     │ GNS LLP      │ A. Khan   │ ACCA     │ 5   [Edit]│ │
│ │ GXY     │ GXY Ltd      │ R. Patel  │ ICAEW    │ 4   [Edit]│ │
│ └─────────┴──────────────┴───────────┴──────────┴───────────┘ │
└───────────────────────────────────────────────────────────────┘
```
Entity editor tabs: **Branding · Address · Bank details · Signatory · AML supervisor · Templates · Settings (chaser cadence, SLA, thresholds)**.

### 4.2 Templates (with live preview) (`FR-DOC-1,2`)
```
┌──────────────────────────────────────┬────────────────────────┐
│ Template: Engagement (GNS · VAT)      │  Preview (sample data) │
│ [Handlebars editor]                   │  [rendered PDF]        │
│  Dear {{client.name}}, ...            │                        │
│  {{> vat_schedule}}                   │   [Refresh preview]    │
│ [Save] [Publish v3]                   │                        │
└──────────────────────────────────────┴────────────────────────┘
```

### 4.3 Services · Users/roles · Integrations
- **Services:** catalogue CRUD, required-documents, requires-clearance flag, engagement clause.
- **Users & roles:** invite, assign roles per entity (matrix from PRD §7).
- **Integrations:** connect Xero/QBO/Graph/KYC/e-sign; show connection health; OAuth start/callback.

---

## 5. Compliance Dashboard — `FR-RPT-3`, `FR-AML-*`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Compliance               Entity: [All ▾]   Period: [This month ▾]     │
├───────────────┬───────────────┬───────────────┬──────────────────────┤
│ CDD complete  │ High-risk open│ Sanctions hits│ Awaiting sign-off     │
│   92%         │     3         │     0         │     5                 │
├───────────────┴───────────────┴───────────────┴──────────────────────┤
│ Sign-off queue (HITL)                                                 │
│ Case         Type        Risk  Agent conf  Action                     │
│ LLP-26-0031  CDD         High  0.71        [Review ▸]                 │
│ GNS-26-0007  Risk        Med   0.88        [Review ▸]                 │
│ GXY-26-0012  Client comm Low   0.93        [Review ▸]                 │
├───────────────────────────────────────────────────────────────────────┤
│ Re-screen due (7) · Companies House changes (1 strike-off ⚠)          │
└──────────────────────────────────────────────────────────────────────┘
```
The **HITL review drawer** shows AI output, evidence, confidence, and Approve / Edit / Reject with mandatory notes (`FR-AI-3`).

---

## 6. Document Center — `FR-COL-*`, `FR-DOC-3`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Documents          Case: [Acme Ltd ▾]   Type[▾] Status[▾]  🔍         │
├──────────────────────────────────────────────────────────────────────┤
│ □ Name                 Type         Class.conf  Status     Actions     │
│ □ passport.pdf         ID           0.98 ✓      Verified   ⬇ 👁 ⋮      │
│ □ acct_2024.pdf        Prior accts  0.84 ⚠      Review     ⬇ ✏ ⋮      │
│ □ bank_mar.pdf         Bank stmt    0.96 ✓      Classified ⬇ 👁 ⋮      │
│ □ unknown_scan.pdf     Unknown      0.40 ⚠      Needs class⬇ ✏ ⋮      │
├──────────────────────────────────────────────────────────────────────┤
│ Right drawer: preview · extracted fields (editable) · reclassify ▾    │
└──────────────────────────────────────────────────────────────────────┘
```
Staff override of classification/extraction here (`FR-COL-6`). Bulk actions; signed-URL downloads only.

---

## 7. Task Management — `FR-TASK-*`

Board + list views.
```
┌──────────────────────────────────────────────────────────────────────┐
│ Tasks   [Board] [List]   Mine ▾  Entity[▾]  Area[▾]   [+ New task]    │
├───────────────┬───────────────┬───────────────┬──────────────────────┤
│ Open          │ In progress   │ Blocked       │ Done                 │
│ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐        │
│ │VAT review │ │ │Chase docs │ │ │Clearance  │ │ │ID check ✓ │        │
│ │Acme · ⏰2d │ │ │Beta ·JS   │ │ │Gamma ·⚠   │ │ │Delta      │        │
│ │High       │ │ │           │ │ │no response│ │ │           │        │
│ └───────────┘ │ └───────────┘ │ └───────────┘ │ └───────────┘        │
└───────────────┴───────────────┴───────────────┴──────────────────────┘
```
Task detail: assignee, due/SLA, comments, attachments, linked case; overdue badge; reassign; escalation indicator.

---

## 8. Communication Center — `FR-COM-*`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Communications   Case: [Acme Ltd ▾]                                   │
├───────────────────────────────────┬──────────────────────────────────┤
│ Threads                           │  Thread: Engagement letter        │
│ • Welcome & next steps   2d       │  ┌────────────────────────────┐   │
│ • Engagement letter      1d  ✍    │  │ → Sent 23 Jun (Graph)      │   │
│ • Missing documents      4h  ⚠    │  │   "Please sign your..."    │   │
│ • Clearance (prev acct)  —        │  │ ← (no reply)               │   │
│                                   │  └────────────────────────────┘   │
│ [+ New message]                   │  AI draft ▾  [Edit] [Approve&send]│
└───────────────────────────────────┴──────────────────────────────────┘
```
AI-drafted messages show a **draft badge** and require Approve before first send (`FR-COM-2`); delivery status (sent/delivered/failed, Graph vs SMTP) shown per message.

---

## 9. Navigation / IA summary

| Portal | Primary nav |
|---|---|
| Client | Dashboard · Documents · Sign · Messages · Help |
| Staff | Cases · Tasks · Reviews · Documents · Communications · Compliance · Reports |
| Admin | Entities · Services · Templates · Users & Roles · Integrations · Settings · Audit |

## 10. Key interaction principles
- **Gate-aware actions:** primary buttons disabled with reason tooltips when a state-machine guard is unmet.
- **HITL everywhere AI acts:** any AI output that affects a client or compliance decision shows confidence + Approve/Edit/Reject.
- **Always auditable:** every screen's actions are logged; case timeline is the single source of "what happened".
- **Empty/blocked/error states** designed for every list and async action.

---

## ✅ Approval gate
**This is Deliverable A6.** Proceeding to **A7 — Development Task Backlog**.
