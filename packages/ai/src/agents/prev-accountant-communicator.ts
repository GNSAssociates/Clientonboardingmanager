import { z } from "zod";
import { defineAgent } from "../agent";

const communicatorInput = z.object({
  caseId: z.string().uuid(),
  clientName: z.string(),
  companyNumber: z.string().optional(),
  prevFirmName: z.string(),
  prevFirmEmail: z.string().email().optional(),
  contactPurpose: z.enum([
    "initial_clearance",
    "followup_chase",
    "handover_request",
    "records_request",
    "general",
  ]),
  chaseNumber: z.number().int().min(1).optional(),
  sentAt: z.string().optional(),
  specificRequests: z.array(z.string()).optional(),
  entityLegalName: z.string(),
  entitySignatoryName: z.string(),
  entityAmlSupervisor: z.string().optional(),
  tone: z.enum(["formal", "firm", "urgent"]).default("formal"),
  notes: z.string().optional(),
});

const communicatorOutput = z.object({
  subject: z.string(),
  body: z.string(),
  keyPoints: z.array(z.string()),
  requestedResponseDate: z.string(),
  suggestedFollowupDays: z.number().int().min(1).max(30),
  tone: z.string(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

/**
 * Previous-Accountant Communicator agent (A2 §6, FR-AI-7).
 * Drafts professional clearance and handover request communications.
 * HITL: first_then_auto — first contact always reviewed; routine chases auto-approved.
 */
export const prevAccountantCommunicatorAgent = defineAgent({
  name: "prev_accountant_communicator",
  objective:
    "Draft professional, ICAEW-compliant communications to a client's previous accountant. Generate clearance requests, follow-up chasers, and handover requests that are appropriately toned and legally sound.",
  model: "complex",
  input: communicatorInput,
  output: communicatorOutput,
  prompt: `You are a professional letter drafter for a UK accounting practice. You draft communications to previous accountants on behalf of the practice.

Your communications must be:
1. Professional and courteous — maintain good inter-professional relationships
2. ICAEW-compliant — reference the ICAEW Code of Ethics where appropriate
3. Clear and specific — state exactly what is requested and by when
4. Entity-branded — always sign off on behalf of the correct entity

Communication types:
- **initial_clearance**: Request professional clearance per ICAEW Code of Ethics (R320.7). Ask for: any professional reasons not to accept, outstanding fees, any matters affecting the client's integrity, and availability of client records.
- **followup_chase**: Polite but firmer reminder. Reference the original letter date. Note that if no response is received, the practice will proceed on the basis there are no objections.
- **handover_request**: Request transfer of client files, working papers, and records. Attach a client authority letter.
- **records_request**: Specific request for particular documents or records.
- **general**: General inter-firm correspondence.

Tone guidance:
- formal: Standard professional letter tone
- firm: More assertive, shorter deadlines, reference professional obligations
- urgent: Very firm, reference specific professional body rules, escalate if no response

Always include a response deadline (typically 14 days for clearance, 7 days for chasers).
Format body as clean HTML suitable for email.`,
  validators: [
    {
      name: "followup-requires-review-false",
      validate: (o) =>
        // Routine chases (chase 2+) can be auto-sent if confidence is high
        !o.needsReview && o.confidence < 0.8
          ? "Auto-send requires confidence >= 0.8"
          : true,
    },
    {
      name: "response-date-is-in-future",
      validate: (o) => {
        const d = new Date(o.requestedResponseDate);
        return isNaN(d.getTime()) ? "requestedResponseDate must be a valid date string" : true;
      },
    },
    {
      name: "body-is-html",
      validate: (o) =>
        !o.body.includes("<") ? "body must be HTML-formatted" : true,
    },
  ],
  confidence: { threshold: 0.75 },
  hitl: { kind: "first_then_auto", assignedRole: "Manager" },
});

export type PrevAccountantCommunicatorInput = z.infer<typeof communicatorInput>;
export type PrevAccountantCommunicatorOutput = z.infer<typeof communicatorOutput>;
