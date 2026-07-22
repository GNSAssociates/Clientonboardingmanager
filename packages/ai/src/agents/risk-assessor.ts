import { z } from "zod";
import { defineAgent } from "../agent";

const riskInput = z.object({
  caseId: z.string().uuid(),
  clientName: z.string(),
  clientType: z.enum(["limited", "sole_trader", "partnership", "llp", "individual"]),
  sicCodes: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  incorporatedOn: z.string().optional(),
  companyStatus: z.string().optional(),
  pepFlag: z.boolean().optional(),
  sanctionsFlag: z.boolean().optional(),
  adverseMediaFlag: z.boolean().optional(),
  sourceOfFunds: z.string().optional(),
  estimatedAnnualRevenue: z.string().optional(),
  numberOfBeneficialOwners: z.number().optional(),
  servicesRequested: z.array(z.string()).optional(),
  previousAccountant: z.string().optional(),
  notes: z.string().optional(),
});

const riskOutput = z.object({
  riskRating: z.enum(["low", "medium", "high"]),
  overallScore: z.number().min(0).max(100),
  factors: z.array(
    z.object({
      factor: z.string(),
      weight: z.enum(["low", "medium", "high"]),
      score: z.number().min(0).max(10),
      rationale: z.string(),
    }),
  ),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  recommendedDdLevel: z.enum(["simplified", "standard", "enhanced"]),
  nextReviewMonths: z.number().int().min(3).max(36),
});

/**
 * Risk Assessor agent (A2 §6, FR-AI-4).
 * Scores client risk across 6 dimensions: sector, PEP/sanctions, geography,
 * structure, source of funds, services. Uses claude-opus for accuracy.
 * HITL: always for high-risk (ComplianceOfficer); below 0.75 for low/medium.
 */
export const riskAssessorAgent = defineAgent({
  name: "risk_assessor",
  objective:
    "Assess the AML risk rating of a new accounting client for a UK practice. Score risk across multiple dimensions and recommend the appropriate level of due diligence. HITL required for high-risk clients.",
  model: "complex",
  input: riskInput,
  output: riskOutput,
  prompt: `You are an AML risk assessment specialist for a UK accounting practice.

Score the client's risk across the following dimensions (0-10 each):
1. **Sector risk** — SIC codes, industry type, cash-intensity
2. **Geographic risk** — jurisdiction, FATF lists, high-risk countries
3. **Structure risk** — complex ownership, multiple jurisdictions, anonymous structures
4. **PEP/Sanctions risk** — flags, adverse media, public profile
5. **Source of funds risk** — clarity, consistency, documentation
6. **Service risk** — services requested and their money-laundering exposure

For each factor:
- Weight it as low/medium/high based on its relevance to MLR 2017
- Score 0 = negligible risk, 10 = extreme risk
- Provide a one-sentence rationale

Overall risk:
- 0-25 → low (Simplified DD acceptable)
- 26-50 → medium (Standard CDD)
- 51-100 → high (Enhanced DD required; senior management approval)

For high-risk clients: needsReview MUST be true.
Recommend next review period: 12 months (low), 6 months (medium), 3 months (high).`,
  validators: [
    {
      name: "high-risk-requires-review",
      validate: (o) =>
        o.riskRating === "high" && !o.needsReview
          ? "High-risk clients always require needsReview = true"
          : true,
    },
    {
      name: "high-risk-requires-edd",
      validate: (o) =>
        o.riskRating === "high" && o.recommendedDdLevel !== "enhanced"
          ? "High-risk clients must receive enhanced due diligence"
          : true,
    },
    {
      name: "score-matches-rating",
      validate: (o) => {
        if (o.riskRating === "low" && o.overallScore > 25) {
          return `Low risk rating but score is ${o.overallScore} (> 25)`;
        }
        if (o.riskRating === "high" && o.overallScore < 51) {
          return `High risk rating but score is ${o.overallScore} (< 51)`;
        }
        return true;
      },
    },
  ],
  confidence: { threshold: 0.75 },
  hitl: { kind: "below_threshold", assignedRole: "ComplianceOfficer" },
});

export type RiskAssessorInput = z.infer<typeof riskInput>;
export type RiskAssessorOutput = z.infer<typeof riskOutput>;
