/**
 * The website-enquiry normaliser, checked against the shapes WordPress actually
 * sends and the ways a form gets edited after it is built.
 *
 *   npx tsx apps/web/scripts/test-lead-parse.mts
 */
import assert from "node:assert/strict";
import { parseLead, leadDedupeKey } from "../lib/lead-parse.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + (e as Error).message); process.exitCode = 1; }
}

console.log("lead-parse");

test("bridge payload: WPForms field list is read by type, then label", () => {
  const p = parseLead({
    form_id: "123", form_name: "Contact us", entry_id: "456", page_url: "https://gnsassociates.co.uk/contact/",
    fields: [
      { name: "Name", type: "name", value: "Jane Smith" },
      { name: "Email", type: "email", value: " Jane@Example.co.uk " },
      { name: "Mobile number", type: "text", value: "07700 900 123" },
      { name: "Company name", type: "text", value: "Trial Ltd" },
      { name: "Company number", type: "text", value: "1234567" },
      { name: "Services you need", type: "checkbox", value: "Accounts\nVAT" },
      { name: "How can we help?", type: "textarea", value: "Switching from our current accountant." },
    ],
  });
  assert.equal(p.name, "Jane Smith");
  assert.equal(p.email, "jane@example.co.uk");
  assert.equal(p.phone, "07700900123");
  assert.equal(p.companyName, "Trial Ltd");
  assert.equal(p.companyNumber, "01234567", "short numbers are padded to 8");
  assert.equal(p.services, "Accounts\nVAT");
  assert.equal(p.message, "Switching from our current accountant.");
  assert.equal(p.formName, "Contact us");
  assert.equal(p.entryId, "456");
  assert.equal(p.looksLikeSpam, false);
  assert.deepEqual(p.extra, []);
});

test("WPForms keys fields by id: an object of fields works like a list", () => {
  const p = parseLead({
    fields: {
      "1": { name: "Your Name", type: "name", value: "Raj Patel" },
      "2": { name: "Your Email", type: "email", value: "raj@shop.co.uk" },
    },
  });
  assert.equal(p.name, "Raj Patel");
  assert.equal(p.email, "raj@shop.co.uk");
});

test("flat payload (Webhooks add-on / Zapier): labels are matched by meaning", () => {
  const p = parseLead({
    first_name: "Amy", last_name: "Lee", email_address: "amy@lee.com", telephone: "+44 20 7946 0000",
    business_name: "Lee Bakery", message: "Need payroll for 4 staff", form_id: "9", _wp_nonce: "abc",
  });
  assert.equal(p.name, "Amy Lee");
  assert.equal(p.email, "amy@lee.com");
  assert.equal(p.phone, "+442079460000");
  assert.equal(p.companyName, "Lee Bakery");
  assert.equal(p.message, "Need payroll for 4 staff");
  assert.equal(p.formId, "9");
  assert.ok(!p.extra.some((x) => /nonce/i.test(x.label)), "housekeeping keys are not shown");
});

test("a renamed or unknown field is kept, not lost", () => {
  const p = parseLead({
    fields: [
      { name: "Email", type: "email", value: "a@b.co" },
      { name: "Turnover band", type: "select", value: "£85k–£250k" },
    ],
  });
  assert.deepEqual(p.extra, [{ label: "Turnover band", value: "£85k–£250k" }]);
});

test("an email typed into an unlabelled box is still found", () => {
  const p = parseLead({ fields: [{ name: "Field 3", type: "text", value: "someone@firm.co.uk" }, { name: "Name", type: "name", value: "S" }] });
  assert.equal(p.email, "someone@firm.co.uk");
});

test("a second free-text box is added to the message", () => {
  const p = parseLead({
    fields: [
      { name: "Email", type: "email", value: "x@y.com" },
      { name: "Message", type: "textarea", value: "First part" },
      { name: "Anything else?", type: "textarea", value: "Second part" },
    ],
  });
  assert.equal(p.message, "First part\n\nAnything else?: Second part");
});

test("invalid email and too-short phone are rejected, not stored as contact details", () => {
  const p = parseLead({ email: "not-an-email", phone: "123", name: "X" });
  assert.equal(p.email, null);
  assert.equal(p.phone, null);
  assert.equal(p.looksLikeSpam, true, "no way to reply → filed as spam");
  assert.match(p.spamReason ?? "", /no email/);
});

test("Scottish company number keeps its prefix", () => {
  assert.equal(parseLead({ email: "a@b.co", company_number: "sc 123456" }).companyNumber, "SC123456");
});

test("spam: link-stuffed message is filed as spam (still stored)", () => {
  const p = parseLead({ email: "seo@spam.biz", message: "Visit https://a.com https://b.com www.c.com now" });
  assert.equal(p.looksLikeSpam, true);
  assert.match(p.spamReason ?? "", /3 links/);
});

test("spam: one link in a genuine enquiry is NOT spam", () => {
  const p = parseLead({ email: "owner@cafe.co.uk", message: "Our website is https://cafe.co.uk — need bookkeeping." });
  assert.equal(p.looksLikeSpam, false);
});

test("spam: honeypot filled", () => {
  assert.equal(parseLead({ email: "a@b.co", hp: "x" }).looksLikeSpam, true);
});

test("dedupe: WPForms form + entry id is the key when present", () => {
  const p = parseLead({ form_id: "1", entry_id: "77", email: "a@b.co" });
  assert.equal(leadDedupeKey(p, new Date("2026-11-15T10:00:00Z")), "wpforms:1:77");
});

test("dedupe: without an entry id, same person + message + day is the same lead", () => {
  const at = new Date("2026-11-15T10:00:00Z");
  const a = parseLead({ email: "A@B.co", message: "Need  accounts" });
  const b = parseLead({ email: "a@b.co", message: "need accounts" });
  const c = parseLead({ email: "a@b.co", message: "need payroll" });
  assert.equal(leadDedupeKey(a, at), leadDedupeKey(b, at));
  assert.notEqual(leadDedupeKey(a, at), leadDedupeKey(c, at));
  assert.notEqual(leadDedupeKey(a, at), leadDedupeKey(a, new Date("2026-11-16T10:00:00Z")));
});

test("security: a javascript: page URL is dropped, a normal one kept", () => {
  assert.equal(parseLead({ email: "a@b.co", page_url: "javascript:alert(1)" }).pageUrl, null);
  assert.equal(parseLead({ email: "a@b.co", page_url: "https://gns.co.uk/contact/" }).pageUrl, "https://gns.co.uk/contact/");
});

test("security: an email that would inject mailto headers is not accepted", () => {
  assert.equal(parseLead({ email: "a@b.co?bcc=x@evil.com" }).email, null);
});

test("garbage in does not throw", () => {
  for (const x of [null, undefined, 42, "text", [], { fields: "nope" }, { fields: [null, 1, "x"] }]) {
    const p = parseLead(x);
    assert.equal(typeof p.looksLikeSpam, "boolean");
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
