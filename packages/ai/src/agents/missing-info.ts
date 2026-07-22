import { z } from "zod";
import { defineAgent } from "../agent";

const checklistItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  category: z.string().optional(),
  required: z.boolean(),
  status: z.enum(["pending", "received", "verified", "na"]),
  hasDocument: z.boolean(),
});

const missingInfoInput = z.object({
  caseId: z.string().uuid(),
  clientName: z.string(),
  clientType: z.string(),
  checklist: z.array(checklistItemSchema),
  uploadedDocumentSummaries: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        category: z.string(),
        status: z.string(),
        checklistItemId: z.string().nullable(),
      }),
    )
    .optional()
    .default([]),
});

const missingInfoOutput = z.object({
  blocking: z.array(
    z.object({
      checklistKey: z.string(),
      label: z.string(),
      reason: z.string(),
    }),
  ),
  nonBlocking: z.array(
    z.object({
      checklistKey: z.string(),
      label: z.string(),
    }),
  ),
  suggestions: z.array(z.string()),
  allDocumentsReceived: z.boolean(),
  confidence: z.number().min(0).max(1),
});

/**
 * Missing-Info Detector agent (A2 §6, FR-AI-3).
 * Analyses the checklist vs received documents and identifies gaps.
 * Auto-accepts at any confidence (output is advisory to staff, not compliance-critical).
 * Runs on demand (e.g. after each upload) and when transitioning to docs_complete.
 */
export const missingInfoDetectorAgent = defineAgent({
  name: "missing_info_detector",
  objective:
    "Compare the checklist requirements against received documents and identify gaps. Distinguish blocking items (required + missing) from non-blocking (optional or already received). Suggest which uploaded documents might satisfy unfulfilled requirements.",
  model: "fast",
  input: missingInfoInput,
  output: missingInfoOutput,
  prompt: `You are a compliance assistant for a UK accounting practice reviewing the document checklist for a new client onboarding case.

Given the checklist and the documents received so far, identify:
1. BLOCKING gaps: required checklist items that have no linked document and are not marked N/A
2. NON-BLOCKING gaps: optional or informational items not yet received
3. SUGGESTIONS: if any uploaded document (unlinked or categorised as "other") might satisfy a pending requirement, note it

Rules:
- A checklist item is satisfied if its status is "received", "verified", or "na"
- A required item with status "pending" and no linked document is blocking
- Be concise — staff read this on screen, not as a report
- Confidence reflects how certain you are about your gap analysis given the information provided`,
  validators: [
    {
      name: "blocking-are-required",
      validate: (o) =>
        o.blocking.length === 0 ||
        o.blocking.every((b) => b.checklistKey !== "") ||
        "blocking items must have checklistKey",
    },
  ],
  confidence: { threshold: 0.0 },
  hitl: { kind: "never" },
});

export type MissingInfoInput = z.infer<typeof missingInfoInput>;
export type MissingInfoOutput = z.infer<typeof missingInfoOutput>;
