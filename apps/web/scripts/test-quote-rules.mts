/**
 * The website's fee rules, checked against figures the live calculator on
 * gnsassociates.co.uk/instant-fee-quote produces, and the quote checker against
 * the two summary formats the site has emailed.
 *
 *   npx tsx apps/web/scripts/test-quote-rules.mts
 */
import assert from "node:assert/strict";
import {
  accountsFee, vatPerQuarter, payrollAnnual, soleFromRecords, bankAccountsAnnual,
  checkQuote, isQuoteSummary, withVat, perMonth,
} from "../lib/quote-rules.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + (e as Error).message); process.exitCode = 1; }
}

console.log("quote-rules");

test("accounts fee follows the website's price points and interpolates between them", () => {
  assert.equal(accountsFee(25000), 300);
  assert.equal(accountsFee(250000), 1500);
  assert.equal(accountsFee(10000000), 7200);
  assert.equal(accountsFee(175000), 1050, "halfway between £900 and £1,200");
});

test("VAT: base for turnover, allowance, extra transactions, BTL discount", () => {
  assert.equal(vatPerQuarter(250000, 0), 125);
  assert.equal(vatPerQuarter(100000, 200), 85, "under £150k: 200 transactions included");
  assert.equal(vatPerQuarter(100000, 300), 85 + 100 * 0.4);
  assert.equal(vatPerQuarter(250000, 250 + 1500), 125 + 1000 * 0.4 + 500 * 0.2, "allowance is 2× base above £150k");
  assert.equal(vatPerQuarter(250000, 0, true), 125 * 0.75);
});

test("payroll: £200 covers two staff, then per head per run", () => {
  assert.equal(payrollAnnual(2, 12), 200);
  assert.equal(payrollAnnual(5, 12), 200 + 3 * 10 * 12);
  assert.equal(payrollAnnual(12, 52), 200 + 10 * 8 * 52);
});

test("sole trader from records, bank accounts", () => {
  assert.equal(soleFromRecords(50000), 100);
  assert.equal(soleFromRecords(100000), 300);
  assert.equal(bankAccountsAnnual(1, 0), 0, "first GBP account is included");
  assert.equal(bankAccountsAnnual(3, 1), 2 * 40 + 90);
});

test("recognises a website quote and nothing else", () => {
  assert.equal(isQuoteSummary("Do you deal with capital gains tax ?"), false);
  assert.equal(isQuoteSummary("Business type | Limited company\nEstimated annual fee (excl. VAT) | £400"), true);
});

test("new-format quote that matches today's prices passes", () => {
  const c = checkQuote([
    "Business type | Limited company",
    "Accounts and Tax Returns (turnover £25,000) | £300",
    "Confirmation Statement filing | £100",
    "Estimated annual fee (excl. VAT) | £400",
    "Estimated annual fee (incl. 20% VAT) | £480",
  ].join("\n"));
  assert.equal(c.found, true);
  assert.equal(c.turnover, 25000);
  assert.deepEqual(c.lines.map((l) => l.ok), [true, true]);
  assert.equal(c.currentTotal, 400);
  assert.deepEqual(c.issues, []);
});

test("a quote from an older calculator is flagged with today's price", () => {
  const c = checkQuote([
    "Business type | Limited company",
    "Accounts and Tax Returns (turnover £250,000) | £1,061",
    "VAT returns (£200 per qtr) | £800",
    "Payroll (base covers 2 staff + 3 extra, 12 runs) | £560",
    "Estimated annual fee (excl. VAT) | £2,421",
  ].join("\n"));
  const acc = c.lines[0]!;
  assert.equal(acc.ok, false);
  assert.equal(acc.current, 1500);
  assert.equal(c.lines[2]!.current, 200 + 3 * 10 * 12);
  assert.equal(c.lines[2]!.ok, true);
  assert.ok(c.issues.some((i) => /Today's price is £1,500/.test(i)));
});

test("old sentence format is read too", () => {
  const c = checkQuote("GNS Associates tentative quote summary. Business type: ltd. Accounts and Tax Returns (dormant): GBP 200 per year. Companies House filing: GBP 100 per year. Estimated annual fee excl VAT: GBP 300. Estimated annual fee incl VAT: GBP 360.");
  assert.equal(c.found, true);
  assert.deepEqual(c.lines.map((l) => [l.label, l.quoted, l.ok]), [
    ["Accounts and Tax Returns (dormant)", 200, true],
    ["Companies House filing", 100, true],
  ]);
  assert.equal(c.quotedTotal, 300);
});

test("lines that do not add up to the total are reported", () => {
  const c = checkQuote("Accounts and Tax Returns (dormant) | £200\nConfirmation Statement filing | £100\nEstimated annual fee (excl. VAT) | £350");
  assert.ok(c.issues.some((i) => /add up to £300/.test(i)));
});

test("turnover over £10m is a custom quote", () => {
  const c = checkQuote("Business type | Limited company\nAnnual turnover | Over £10,000,000\nNotes | Custom quote needed\nEstimated annual fee (excl. VAT) | Custom quote");
  assert.equal(c.customQuote, true);
});

test("VAT and monthly helpers", () => {
  assert.equal(withVat(400), 480);
  assert.equal(perMonth(2400), 200);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
