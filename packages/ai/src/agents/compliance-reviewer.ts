import { z } from "zod";
import { defineAgent } from "../agent";

const reviewerInput = z.object({
  caseId: z.string().uuid(),
  clientName: z.string(),
  clientType: z.enum(["limited", "sole_trader", "partnership", "llp", "individual"]),
  companyStatus: z.string().optional(),
  companyNumber: z.string().optional(),
  sicCodes: z.array(z.string()).optional(),
  kycStatus: z.string().optional(),
  cddOutcome: z.string().optional(),
  pepFlag: z.boolean().optional(),
  sanctionsFlag: z.boolean().optional(),
  adverseMediaFlag: z.boolean().optional(),
  sourceOfFunds: z.string().optional(),
  riskRating: z.string().optional(),
  documentsCollected: z.array(z.string()).optional(),
  missingDocuments: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const reviewerOutput = z.object({
  overallCompliant: z.boolean(),
  amlRisk: z.enum(["low", "medium", "high"]),
  gaps: z.array(z.string()),
  redFlags: z.array(z.string()),
  recommendations: z.array(z.string()),
  requiredActions: z.array(z.string()),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

/**
 * Compliance Reviewer agent (A2 §6, FR-AI-5).
 * Assesses AML/CDD completeness and flags regulatory gaps.
 * Uses claude-opus for depth of analysis.
 * HITL: ALWAYS — all compliance decisions require human sign-off (MLR 2017).
 */
export const complianceReviewerAgent = defineAgent({
  name: "compliance_reviewer",
  objective:
    "Review a client's AML/CDD profile for a UK accounting practice. Identify regulatory gaps, red flags, and required actions under the Money Laundering Regulations 2017. Return a compliance assessment with confidence score.",
  model: "complex",
  input: reviewerInput,
  output: reviewerOutput,
  prompt: `You are a compliance expert for a UK accounting practice regulated under the Money Laundering Regulations 2017 (MLR 2017).

Your task is to review the client's compliance profile and provide:
1. Whether the profile is compliant with MLR 2017 requirements
2. AML risk level (low/medium/high) based on the evidence provided
3. Any gaps in documentation or information
4. Red flags that require escalation
5. Recommended next actions

UK MLR 2017 requirements for accountancy practices:
- Client identification and verification (ID + PoA)
- Beneficial owner identification (for companies/LLPs)
- Source of funds / wealth documentation (for high-risk or EDD)
- Business activity verification
- PEP / sanctions screening
- Ongoing monitoring requirements

Risk factors that elevate to high risk:
- PEP connections
- Sanctions matches
- High-risk jurisdictions (FATF grey/blacklist)
- Unusual business structure
- Inconsistent source of funds
- High-value transactions
- Cash-intensive business
- Adverse media

Be thorough but practical. A missing document that can still be obtained is a gap, not a red flag.
A PEP flag requires Enhanced Due Diligence (EDD) and senior management approval.`,
  validators: [
    {
      name: "red-flags-require-review",
      validate: (o) =>
        o.redFlags.length > 0 && !o.needsReview
          ? "Red flags were found but needsReview is false"
          : true,
    },
    {
      name: "high-risk-requires-review",
      validate: (o) =>
        o.amlRisk === "high" && !o.needsReview
          ? "High AML risk requires needsReview = true"
          : true,
    },
    {
      name: "non-compliant-has-required-actions",
      validate: (o) =>
        !o.overallCompliant && o.requiredActions.length === 0
          ? "Non-compliant result must have at least one required action"
          : true,
    },
  ],
  confidence: { threshold: 0.7 },
  hitl: { kind: "always", assignedRole: "ComplianceOfficer" },
});

export type ComplianceReviewerInput = z.infer<typeof reviewerInput>;
export type ComplianceReviewerOutput = z.infer<typeof reviewerOutput>;
