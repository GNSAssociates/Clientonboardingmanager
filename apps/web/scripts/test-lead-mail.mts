/**
 * Lead email history: direction, merging copies across mailboxes, quotes.
 *
 *   npx tsx apps/web/scripts/test-lead-mail.mts
 */
import assert from "node:assert/strict";
import { mergeMailboxResults, addAppSent, isOurs, searchableEmail, looksLikeQuote } from "../lib/lead-mail-match.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + (e as Error).message); process.exitCode = 1; }
}
const OURS = ["gnsassociates.co.uk", "gnsuk.com"];
const a = (address: string, name?: string) => ({ emailAddress: { address, name } });

console.log("lead-mail");

test("our domains (and subdomains) count as GNS; others do not", () => {
  assert.equal(isOurs("mahesh@gnsassociates.co.uk", OURS), true);
  assert.equal(isOurs("info@gnsuk.com", OURS), true);
  assert.equal(isOurs("x@mail.gnsassociates.co.uk", OURS), true);
  assert.equal(isOurs("jane@client.co.uk", OURS), false);
  assert.equal(isOurs("x@notgnsassociates.co.uk", OURS), false);
});

test("one email in two mailboxes is shown once, listing both; sender's copy gives the link", () => {
  const msg = {
    id: "1", internetMessageId: "<abc@x>", subject: "Your quote", from: a("mahesh@gnsassociates.co.uk", "Mahesh"),
    toRecipients: [a("jane@client.co.uk")], ccRecipients: [a("info@gnsassociates.co.uk")],
    sentDateTime: "2026-11-10T10:00:00Z", receivedDateTime: "2026-11-10T10:00:01Z",
  };
  const out = mergeMailboxResults([
    { mailbox: "info@gnsassociates.co.uk", message: { ...msg, webLink: "info-link" } },
    { mailbox: "mahesh@gnsassociates.co.uk", message: { ...msg, id: "2", webLink: "sender-link" }, attachments: ["GNS fee proposal.pdf"] },
  ], OURS);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.direction, "out");
  assert.deepEqual(out[0]!.mailboxes, ["info@gnsassociates.co.uk", "mahesh@gnsassociates.co.uk"]);
  assert.equal(out[0]!.webLink, "sender-link");
  assert.equal(out[0]!.isQuote, true);
});

test("client emails are 'in'; drafts are left out; newest first", () => {
  const out = mergeMailboxResults([
    { mailbox: "info@gnsassociates.co.uk", message: { id: "a", internetMessageId: "<1>", subject: "Hello", from: a("jane@client.co.uk"), receivedDateTime: "2026-11-01T09:00:00Z" } },
    { mailbox: "info@gnsassociates.co.uk", message: { id: "b", internetMessageId: "<2>", subject: "Re: Hello", from: a("info@gnsassociates.co.uk"), sentDateTime: "2026-11-02T09:00:00Z" } },
    { mailbox: "info@gnsassociates.co.uk", message: { id: "c", internetMessageId: "<3>", subject: "unsent", from: a("info@gnsassociates.co.uk"), isDraft: true, sentDateTime: "2026-11-03T09:00:00Z" } },
  ], OURS);
  assert.deepEqual(out.map((e) => [e.subject, e.direction]), [["Re: Hello", "out"], ["Hello", "in"]]);
});

test("platform-sent emails are added unless the same one is already in Sent Items", () => {
  const mailbox = mergeMailboxResults([
    { mailbox: "info@gnsassociates.co.uk", message: { id: "a", internetMessageId: "<1>", subject: "Engagement letter", from: a("info@gnsassociates.co.uk"), sentDateTime: "2026-11-05T12:00:30Z" } },
  ], OURS);
  const out = addAppSent(mailbox, [
    { subject: "Engagement letter", sentAt: "2026-11-05T12:00:10.000Z", template: "engagement_letter" },
    { subject: "Documents needed", sentAt: "2026-11-06T08:00:00.000Z", template: "document_request" },
  ], "info@gnsassociates.co.uk");
  assert.deepEqual(out.map((e) => [e.subject, e.source]), [["Documents needed", "app"], ["Engagement letter", "mailbox"]]);
});

test("only a plain address is ever searched for", () => {
  assert.equal(searchableEmail(" Jane@Client.co.uk "), "jane@client.co.uk");
  assert.equal(searchableEmail('x" OR "from:*'), null);
  assert.equal(searchableEmail(null), null);
});

test("quote detection by subject or attachment name", () => {
  assert.equal(looksLikeQuote("Your quote from GNS", []), true);
  assert.equal(looksLikeQuote("Hello", ["Letter of engagement.pdf"]), true);
  assert.equal(looksLikeQuote("Meeting on Friday", ["agenda.docx"]), false);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
