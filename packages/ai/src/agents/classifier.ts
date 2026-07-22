import { z } from "zod";
import { DEFAULT_CONFIDENCE_THRESHOLD } from "@gns/config";
import { defineAgent } from "../agent";

const DOCUMENT_CATEGORIES = [
  "id_document",
  "proof_of_address",
  "bank_statement",
  "vat_return",
  "payroll_record",
  "accounts",
  "tax_return",
  "company_formation",
  "contract",
  "other",
] as const;

const classifierInput = z.object({
  documentId: z.string().uuid(),
  label: z.string(),
  mimeType: z.string(),
  extractedText: z.string().optional(),
  extractedFields: z.record(z.unknown()).optional(),
  clientType: z.string().optional(),
  existingCategory: z.string().optional(),
});

const classifierOutput = z.object({
  category: z.enum(DOCUMENT_CATEGORIES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  needsReview: z.boolean(),
  suggestedLabel: z.string().optional(),
});

/**
 * Document Classifier agent (A2 §6, FR-AI-2).
 * Uses claude-haiku for cost efficiency on high-volume classification.
 * Auto-accepts at ≥0.85; routes below-threshold to HITL.
 */
export const documentClassifierAgent = defineAgent({
  name: "document_classifier",
  objective:
    "Classify an uploaded document into one of the standard categories based on its label, MIME type, and extracted text. Return a confidence score and flag low-confidence results for human review.",
  model: "fast",
  input: classifierInput,
  output: classifierOutput,
  prompt: `You are a document classification assistant for a UK accounting practice.
Classify the provided document into exactly one category.

Categories and their meanings:
- id_document: Passport, driving licence, national ID card
- proof_of_address: Utility bill, bank statement showing address, council tax letter (dated ≤3 months)
- bank_statement: Bank or building society statement (financial, not proof of address use)
- vat_return: HMRC VAT return or VAT registration certificate
- payroll_record: P60, P45, payslip, PAYE report, P11D
- accounts: Company accounts, management accounts, balance sheet, P&L
- tax_return: Self assessment (SA100/SA302), corporation tax (CT600)
- company_formation: Certificate of incorporation, memorandum & articles, Companies House filing
- contract: Signed engagement letter, service agreement, letter of authority
- other: Anything that does not clearly fit the above

Rules:
1. Use the label, MIME type, and extracted text together.
2. Set confidence to how certain you are (0.0–1.0). Be conservative.
3. If confidence < ${DEFAULT_CONFIDENCE_THRESHOLD}, set needsReview to true.
4. Provide concise reasoning (1–2 sentences).
5. Only suggest a corrected label if the existing one is clearly wrong or misleading.`,
  validators: [
    {
      name: "confidence-range",
      validate: (o) => (o.confidence >= 0 && o.confidence <= 1 ? true : "confidence out of range"),
    },
    {
      name: "needs-review-matches-threshold",
      validate: (o) =>
        o.confidence < DEFAULT_CONFIDENCE_THRESHOLD === o.needsReview
          ? true
          : "needsReview must be true when confidence < threshold",
    },
  ],
  confidence: { threshold: DEFAULT_CONFIDENCE_THRESHOLD },
  hitl: { kind: "below_threshold", assignedRole: "Reviewer" },
});

export type ClassifierInput = z.infer<typeof classifierInput>;
export type ClassifierOutput = z.infer<typeof classifierOutput>;
