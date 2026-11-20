/**
 * Reading the GNS CRM API's responses, in both namings its documentation uses.
 *
 *   npx tsx apps/web/scripts/test-crm-shape.mts
 */
import assert from "node:assert/strict";
import {
  readCompany, readListPage, readDetail, normaliseCompanyNumber, crmDate, personKey, peopleOf,
} from "../lib/crm-shape.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + (e as Error).message); process.exitCode = 1; }
}

console.log("crm-shape");

test("list row in the guide's naming", () => {
  const c = readCompany({ id: 123, name: "Example Company Ltd", company: "Example Company Ltd", number_o: "1234567", companystatus: "active" })!;
  assert.equal(c.crmId, "123");
  assert.equal(c.companyName, "Example Company Ltd");
  assert.equal(c.companyNumber, "01234567");
  assert.equal(c.companiesHouseStatus, "active");
});

test("profile in the field reference's naming, with dates", () => {
  const c = readCompany({
    company_id: "77", company_name: "Trial Ltd", client_name: "Trial", company_number: "SC12345",
    accounts_due_date: "2026-12-31", confirmation_statement_due_date: "2027-01-15 00:00:00", incorporation_date: "03/02/2019",
    companies_house_status: "active",
  })!;
  assert.equal(c.crmId, "77");
  assert.equal(c.companyNumber, "SC012345");
  assert.equal(c.accountsDue, "2026-12-31");
  assert.equal(c.confirmationStatementDue, "2027-01-15");
  assert.equal(c.incorporated, "2019-02-03");
});

test("a row without an id is ignored", () => {
  assert.equal(readCompany({ name: "No id" }), null);
});

test("list page: top-level paginator (as documented) and Laravel meta", () => {
  const a = readListPage({ success: true, data: [{ id: 1 }, { id: 2 }], current_page: 1, per_page: 100, total: 514, last_page: 6 }, 1);
  assert.deepEqual([a.rows.length, a.page, a.lastPage, a.total], [2, 1, 6, 514]);
  const b = readListPage({ data: [{ id: 1 }], meta: { current_page: 3, last_page: 6, total: 514 } }, 3);
  assert.deepEqual([b.page, b.lastPage, b.total], [3, 6, 514]);
  const empty = readListPage({ success: true, data: [] }, 7);
  assert.equal(empty.lastPage, 7, "an empty page is the last page");
});

test("detail: profile and related datasets, hyphen or underscore keys", () => {
  const d = readDetail({
    success: true,
    data: {
      company: { id: 123, name: "Example Company Ltd", number_o: "01234567" },
      related_records: {
        directors: [{ name: "SMITH, Jane Anne", role: "director", verification_due_date: "2026-12-01" }],
        "business-activities": [{ activity_code: "69201" }],
        people_with_significant_control: [{ person_name: "Mr John Smith", ceased_date: null }],
        charges: "not-a-list",
      },
    },
  });
  assert.equal(d.company?.crmId, "123");
  assert.equal(d.datasets.directors?.length, 1);
  assert.equal(d.datasets["business-activities"]?.length, 1);
  assert.equal(d.datasets["people-with-significant-control"]?.length, 1);
  assert.equal(d.datasets.charges, undefined, "a non-list is not a dataset");
});

test("company numbers and dates normalise; junk returns null", () => {
  assert.equal(normaliseCompanyNumber(" 7094359 "), "07094359");
  assert.equal(normaliseCompanyNumber("oc301234"), "OC301234");
  assert.equal(normaliseCompanyNumber(""), null);
  assert.equal(crmDate("not a date"), null);
});

test("people: CH 'SURNAME, Forenames' matches 'Forenames Surname'; titles ignored", () => {
  assert.equal(personKey("SMITH, Jane Anne"), personKey("Mrs Jane Anne Smith"));
  assert.notEqual(personKey("Jane Smith"), personKey("John Smith"));
  assert.equal(personKey("  "), null);
});

test("people: directors (current unless resigned) and PSCs (current unless ceased)", () => {
  const p = peopleOf({
    directors: [
      { first_name: "Raj", last_name: "Pandey", role: "director", verification_due_date: "2026-11-30" },
      { name: "Old Director", resignation_date: "2024-01-01" },
      { name: "Flagged", current: 0 },
    ],
    "people-with-significant-control": [{ person_name: "Dr Raksha Thapa", ceased_date: "2025-05-01" }],
  });
  assert.deepEqual(p.map((x) => [x.name, x.kind, x.current]), [
    ["Raj Pandey", "director", true],
    ["Old Director", "director", false],
    ["Flagged", "director", false],
    ["Dr Raksha Thapa", "psc", false],
  ]);
  assert.equal(p[0]!.verificationDue, "2026-11-30");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
