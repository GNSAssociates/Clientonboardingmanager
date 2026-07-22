import { z } from "zod";
import { defineAgent } from "../agent";

const ledgerReviewerInput = z.object({
  reviewType: z.enum(["bookkeeping", "vat", "paye", "cis", "accounts", "trial_balance", "self_assessment"]),
  period: z.string(),
  clientName: z.string(),
  entityId: z.string().uuid(),
  snapshotData: z.object({
    trialBalance: z.array(z.record(z.unknown())).optional(),
    vatReturns: z.array(z.record(z.unknown())).optional(),
    payrollRecords: z.array(z.record(z.unknown())).optional(),
    chartOfAccounts: z.array(z.record(z.unknown())).optional(),
    ledgers: z.array(z.record(z.unknown())).optional(),
  }),
  priorPeriodSummary: z.string().optional(),
  clientType: z.enum(["limited", "sole_trader", "partnership", "llp", "individual"]),
});

const reviewFindingSchema = z.object({
  severity: z.enum(["info", "warning", "error", "critical"]),
  category: z.string(),
  description: z.string(),
  affectedPeriod: z.string().optional(),
  evidence: z.record(z.unknown()).optional(),
  recommendedAction: z.string(),
});

const ledgerReviewerOutput = z.object({
  findings: z.array(reviewFindingSchema),
  summary: z.string(),
  overallStatus: z.enum(["clean", "minor_issues", "significant_issues", "critical_issues"]),
  requiresImmediateAttention: z.boolean(),
  vatPosition: z.string().optional(),
  payrollCompliance: z.string().optional(),
  cisObligations: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reviewedPeriods: z.array(z.string()),
});

/**
 * Bookkeeping / Ledger Reviewer agent (A2 §6, FR-AI-8).
 * Analyses Xero/QBO ledger snapshots and produces structured findings.
 * Always routed through staff review before communicating to client.
 */
export const ledgerReviewerAgent = defineAgent({
  name: "ledger_reviewer",
  objective:
    "Perform a professional-grade bookkeeping and compliance review of accounting ledger data. Identify errors, omissions, VAT issues, payroll discrepancies, and CIS obligations. Produce structured findings for staff review.",
  model: "complex",
  input: ledgerReviewerInput,
  output: ledgerReviewerOutput,
  prompt: `You are a qualified UK bookkeeping and accounts reviewer for a professional accountancy practice.

Your role is to analyse ledger data pulled from Xero or QuickBooks and produce a structured review report.

Review scope by type:
- **bookkeeping**: posting errors, uncategorised transactions, bank reconciliation issues, duplicate entries
- **vat**: VAT return accuracy, reverse charge, exempt/zero-rated treatment, MTD compliance
- **paye**: PAYE/NIC calculations, RTI submissions, expense claims, benefit-in-kind
- **cis**: CIS deductions, subcontractor verifications, monthly returns, gross payment status
- **accounts**: P&L accuracy, balance sheet reconciliation, accruals, prepayments, depreciation
- **trial_balance**: TB balancing, suspense accounts, mispostings, year-end adjustments
- **self_assessment**: personal income sources, allowable deductions, HMRC submissions

For each finding:
- Assign severity: info (advisory), warning (should fix), error (must fix), critical (regulatory risk)
- Provide specific evidence from the data
- Give a clear recommended action

Severity escalation rules:
- PAYE/NIC discrepancies > £500: error
- VAT error > 1% of turnover or > £5,000: critical
- Unreconciled bank items > 90 days: error
- Unverified CIS subcontractors: critical

Be precise, reference specific accounts/codes where possible.`,
  validators: [
    {
      name: "critical-requires-attention",
      validate: (o) => {
        const hasCritical = o.findings.some((f) => f.severity === "critical");
        return hasCritical && !o.requiresImmediateAttention
          ? "Critical findings must set requiresImmediateAttention=true"
          : true;
      },
    },
    {
      name: "findings-match-status",
      validate: (o) => {
        const maxSeverity = o.findings.reduce<number>((acc, f) => {
          const rank = { info: 0, warning: 1, error: 2, critical: 3 };
          return Math.max(acc, rank[f.severity] ?? 0);
        }, 0);
        const statusRank = { clean: 0, minor_issues: 1, significant_issues: 2, critical_issues: 3 };
        const expectedMin = maxSeverity >= 3 ? 3 : maxSeverity >= 2 ? 2 : maxSeverity >= 1 ? 1 : 0;
        return statusRank[o.overallStatus] < expectedMin
          ? "overallStatus inconsistent with finding severity levels"
          : true;
      },
    },
  ],
  confidence: { threshold: 0.75 },
  hitl: { kind: "always", assignedRole: "Reviewer" },
});

export type LedgerReviewerInput = z.infer<typeof ledgerReviewerInput>;
export type LedgerReviewerOutput = z.infer<typeof ledgerReviewerOutput>;
