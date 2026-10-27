/**
 * The handover checklist, checked against the two worked examples the partner
 * gave — because the periods are the part a staff member cannot verify for
 * themselves, and a wrong one is invisible until a payroll is run.
 *
 *   npx tsx apps/web/scripts/test-handover-checklist.mts
 */
import assert from "node:assert/strict";
import {
  buildChecklist, payrollPeriod, p11dPeriod, bookkeepingPeriod,
  previousMonthEnd, formatUk, type ClientFacts,
} from "../lib/handover-checklist.ts";

const d = (iso: string) => new Date(iso + "T00:00:00Z");
let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + (e as Error).message); process.exitCode = 1; }
}

// ── The example: a client arriving 27 October 2026 ───────────────────────

const octoberClient: ClientFacts = {
  onboardingDate: d("2026-10-27"),
  vatRegistered: true,
  payeRegistered: true,
  hasFilingHistory: true,
  lastAccountsTo: d("2025-10-31"),
  lastVatReturnTo: d("2026-08-31"),
  previousSoftware: "Sage",
};

test("P11D is wanted to 30 September 2026, so October's payroll can be run", () => {
  const p = p11dPeriod(octoberClient);
  assert.equal(formatUk(p.to), "30 September 2026");
  assert.match(p.why, /October payroll/);
});

test("payroll records run from the day after the last filed accounts", () => {
  // Accounts to 31 October 2025, so records are needed from 1 November 2025.
  const p = payrollPeriod(octoberClient);
  assert.equal(formatUk(p.from!), "1 November 2025");
  assert.equal(formatUk(p.to), "30 September 2026");
  assert.match(p.why, /opening position/);
});

test("bookkeeping is wanted to the last VAT return they filed", () => {
  const b = bookkeepingPeriod(octoberClient)!;
  assert.equal(formatUk(b.to), "31 August 2026");
});

test("a month end is the month end, not 30 days back", () => {
  assert.equal(formatUk(previousMonthEnd(d("2026-03-05"))), "28 February 2026");
  assert.equal(formatUk(previousMonthEnd(d("2026-01-15"))), "31 December 2025");
  assert.equal(formatUk(previousMonthEnd(d("2024-03-10"))), "29 February 2024");  // leap year
});

// ── The example: Roam Ventures, incorporated months ago ──────────────────

const newCompany: ClientFacts = {
  onboardingDate: d("2026-10-27"),
  vatRegistered: false,
  payeRegistered: false,
  hasFilingHistory: false,
  lastAccountsTo: null,
};

test("a newly incorporated company is not chased for a CT600 that cannot exist", () => {
  const items = buildChecklist(newCompany);
  const ct600 = items.find((i) => i.key === "ct600_last_year")!;
  assert.equal(ct600.applies, false);
  assert.match(ct600.naReason!, /newly incorporated/);
});

test("no PAYE scheme means the whole payroll section is marked not applicable", () => {
  const payroll = buildChecklist(newCompany).filter((i) => i.category === "payroll");
  assert.ok(payroll.length >= 6, "the items are kept, not hidden");
  assert.ok(payroll.every((i) => i.applies === false && /no PAYE scheme/.test(i.naReason!)),
    "every one answered, so nobody wonders whether it was asked");
});

test("an annual client with no VAT is not asked for bookkeeping to a VAT return", () => {
  const bk = buildChecklist(newCompany).find((i) => i.key === "bookkeeping_records")!;
  assert.equal(bk.applies, false);
  assert.match(bk.naReason!, /annual client, not VAT registered/);
  assert.equal(bookkeepingPeriod(newCompany), null);
});

// ── The VAT login that caused the trouble ────────────────────────────────

test("whether the client is VAT registered is asked FIRST, and flagged when unknown", () => {
  const unknown = buildChecklist({ ...octoberClient, vatRegistered: null });
  const vatItems = unknown.filter((i) => i.category === "vat");
  assert.equal(vatItems[0]!.key, "vat_registered_confirmed", "it must lead the section");
  assert.equal(vatItems[0]!.applies, true, "always asked, whatever the answer");
  assert.match(vatItems[0]!.hint!, /gateway problem last time/);
});

test("a VAT-registered client is asked for the gateway authorisation receipt", () => {
  const items = buildChecklist(octoberClient);
  const receipt = items.find((i) => i.key === "vat_gateway_auth")!;
  assert.equal(receipt.applies, true);
  assert.equal(receipt.source, "hmrc");
});

// ── Who gets chased ──────────────────────────────────────────────────────

test("every item says who holds it, so chasing is not guesswork", () => {
  for (const i of buildChecklist(octoberClient)) {
    assert.ok(["previous_accountant", "client", "hmrc", "us"].includes(i.source),
      i.key + " has no source");
  }
  const fromPrevious = buildChecklist(octoberClient).filter((i) => i.source === "previous_accountant" && i.applies);
  assert.ok(fromPrevious.length >= 8, "the previous accountant list is the one that gets chased");
});

test("the client's four identity items are always asked", () => {
  const client = buildChecklist(newCompany).filter((i) => i.category === "client");
  assert.deepEqual(client.map((i) => i.key), ["client_id", "client_address", "aml", "cdd"]);
  assert.ok(client.every((i) => i.applies));
});

console.log("\n" + passed + " checks passed");
