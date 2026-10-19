/**
 * Whether an engagement may still be edited — fees, services, scope and all.
 *
 * The rule is the client's, not ours: an engagement is open to editing only
 * while the client has committed to NOTHING. The moment they have put their
 * name to it or handed over bank details, what they committed to is fixed and
 * the way to change it is a new engagement, not a rewrite of the old one.
 *
 * Deliberately conservative. Editing is a convenience; silently changing the
 * fees under someone who has already authorised a Direct Debit at the old
 * figure is a problem that surfaces as a disputed collection months later.
 * When in doubt this blocks, and names what is blocking so staff can see why.
 */

export interface EngagementEditState {
  /** True only when the client has committed to nothing at all. */
  editable: boolean;
  /** Client commitments that close editing. Empty when editable. */
  blockers: string[];
  /**
   * Things that do not close editing but that staff should know before they
   * change what a client is looking at.
   */
  warnings: string[];
}

/** The parts of a link this decision depends on. */
export interface EditGateInput {
  status?: string | null;
  signedHtml?: string | null;
  acceptanceData?: Record<string, unknown> | null;
}

export function engagementEditState(link: EditGateInput): EngagementEditState {
  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const gc = (acc.gocardless ?? {}) as Record<string, unknown>;
  const blockers: string[] = [];
  const warnings: string[] = [];

  // --- Signed, electronically.
  if (link.status === "accepted") blockers.push("The client has signed this engagement.");
  else if (link.signedHtml) blockers.push("A signed copy of this contract exists.");
  else if (typeof acc.signatureName === "string" && acc.signatureName.trim()) {
    blockers.push("The client has signed this engagement.");
  }

  // --- Signed on paper and recorded by staff. The wet-signed original is the
  //     executed document; this system cannot edit what is in a filing cabinet.
  if (acc.signedOnPaper) blockers.push("A paper signature has been recorded for this contract.");

  // --- Signed, with the Direct Debit still settling.
  if (link.status === "pending_dd") {
    blockers.push("The client has signed and their Direct Debit is still being confirmed.");
  }

  // --- Bank details given. A mandate is the client authorising collection;
  //     it exists whether or not they went on to sign.
  if (gc.ddConfirmed === true || (typeof gc.mandateId === "string" && gc.mandateId)) {
    blockers.push("The client has set up a Direct Debit mandate.");
  } else if (typeof gc.billingRequestId === "string" && gc.billingRequestId) {
    /* They opened the Direct Debit flow but no mandate came back — abandoned,
       or still in progress. Not a commitment, so it does not block; but if they
       are mid-flow the fees can move under them, which is worth knowing. */
    warnings.push("The client has started setting up a Direct Debit but has not completed it.");
  }

  // --- Not a commitment, but effort the client has already put in.
  const docs = acc.directorDocs;
  if (Array.isArray(docs) && docs.length > 0) {
    warnings.push("The client has already uploaded documents.");
  }
  if (acc.firstViewedAt || acc.prevFirmAddress || acc.noPrevAccountant === true) {
    warnings.push("The client has already opened this contract and entered some details.");
  }

  return { editable: blockers.length === 0, blockers, warnings };
}

/** One-line reason for an API refusal. */
export function editRefusalMessage(state: EngagementEditState): string {
  return (
    `This engagement can no longer be edited: ${state.blockers.join(" ")} ` +
    `Issue a new engagement instead, or record the change as agreed terms if it has already been signed.`
  );
}
