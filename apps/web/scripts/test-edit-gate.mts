/**
 * The edit gate: editing is open only while the client has committed to
 * nothing. Every way a client can commit must close it.
 *
 *   node_modules/.bin/tsx scripts/test-edit-gate.mts
 */
import { engagementEditState } from "../lib/engagement-edit-gate";

let pass = 0;
const failures: string[] = [];
const check = (label: string, actual: unknown, expected: unknown) => {
  if (actual === expected) pass++;
  else failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

// --- Open: sent, client has done nothing.
check("freshly sent is editable", engagementEditState({ status: "sent" }).editable, true);
check("no data at all is editable", engagementEditState({}).editable, true);
check("draft is editable", engagementEditState({ status: "draft" }).editable, true);

// --- Closed: signed, in each of the ways that can be recorded.
check("accepted is not editable", engagementEditState({ status: "accepted" }).editable, false);
check(
  "a signed copy closes it even if status lags",
  engagementEditState({ status: "sent", signedHtml: "<html>signed</html>" }).editable,
  false,
);
check(
  "a recorded signature name closes it",
  engagementEditState({ status: "sent", acceptanceData: { signatureName: "Jane Smith" } }).editable,
  false,
);
check(
  "a paper signature closes it",
  engagementEditState({
    status: "sent",
    acceptanceData: { signedOnPaper: { recordedBy: "SG", recordedAt: "2026-10-01" } },
  }).editable,
  false,
);
check("pending_dd closes it", engagementEditState({ status: "pending_dd" }).editable, false);

// --- Closed: bank details given. THE CASE THIS RULE EXISTS FOR — a client can
//     set up a Direct Debit before signing, so a status check alone would miss
//     it and let the fees move under an authorised mandate.
check(
  "a confirmed mandate closes it even though unsigned",
  engagementEditState({ status: "sent", acceptanceData: { gocardless: { ddConfirmed: true } } }).editable,
  false,
);
check(
  "a mandate id closes it even without the confirmed flag",
  engagementEditState({ status: "sent", acceptanceData: { gocardless: { mandateId: "MD123" } } }).editable,
  false,
);

// --- Open but worth knowing: an abandoned or in-flight DD is not a commitment.
{
  const s = engagementEditState({
    status: "sent",
    acceptanceData: { gocardless: { billingRequestId: "BRQ123" } },
  });
  check("an incomplete DD does not block", s.editable, true);
  check("an incomplete DD is warned about", s.warnings.length > 0, true);
}

// --- Open but worth knowing: the client has engaged without committing.
{
  const s = engagementEditState({
    status: "sent",
    acceptanceData: { directorDocs: [{ id: "passport", status: "ready" }], noPrevAccountant: true },
  });
  check("uploads and entered details do not block", s.editable, true);
  check("but they are warned about", s.warnings.length >= 2, true);
}

// --- Blockers are reported, not just counted: staff need to know why.
{
  const s = engagementEditState({ status: "sent", acceptanceData: { gocardless: { ddConfirmed: true } } });
  check("the blocker names the Direct Debit", s.blockers.some((b) => b.includes("Direct Debit")), true);
}

// --- Several commitments at once are all listed.
{
  const s = engagementEditState({
    status: "accepted",
    acceptanceData: { gocardless: { ddConfirmed: true }, signedOnPaper: { recordedBy: "SG", recordedAt: "x" } },
  });
  check("multiple blockers all reported", s.blockers.length, 3);
  check("still not editable", s.editable, false);
}

// --- An empty gocardless object must not be mistaken for a mandate.
check(
  "empty gocardless object does not block",
  engagementEditState({ status: "sent", acceptanceData: { gocardless: {} } }).editable,
  true,
);
check(
  "empty mandate id string does not block",
  engagementEditState({ status: "sent", acceptanceData: { gocardless: { mandateId: "" } } }).editable,
  true,
);
check(
  "ddConfirmed false does not block",
  engagementEditState({ status: "sent", acceptanceData: { gocardless: { ddConfirmed: false } } }).editable,
  true,
);
// A blank signature name is not a signature.
check(
  "blank signature name does not block",
  engagementEditState({ status: "sent", acceptanceData: { signatureName: "   " } }).editable,
  true,
);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
