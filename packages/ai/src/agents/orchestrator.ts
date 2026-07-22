import { z } from "zod";
import { defineAgent } from "../agent";

const orchestratorInput = z.object({
  caseId: z.string().uuid(),
  currentStatus: z.string(),
  entityId: z.string().uuid(),
  clientName: z.string(),
  clientType: z.enum(["limited", "sole_trader", "partnership", "llp", "individual"]),
  completedSteps: z.array(z.string()),
  pendingChecklist: z.array(z.string()),
  complianceGates: z.record(z.string()).optional(),
  lastEvent: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

const orchestratorOutput = z.object({
  nextAction: z.enum([
    "advance_status",
    "trigger_agent",
    "request_document",
    "send_communication",
    "hold",
    "complete",
  ]),
  targetStatus: z.string().optional(),
  agentToTrigger: z.string().optional(),
  documentRequired: z.string().optional(),
  communicationType: z.string().optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  blockers: z.array(z.string()),
  estimatedCompletionDays: z.number().int().min(0).optional(),
});

/**
 * Workflow Orchestrator agent (A2 §6, FR-AI-1).
 * Drives the onboarding state machine. Decides the next action based on
 * case context. HITL on exceptions only.
 */
export const orchestratorAgent = defineAgent({
  name: "orchestrator",
  objective:
    "Analyse a client onboarding case and determine the optimal next action to progress it through the onboarding pipeline. Consider compliance gates, outstanding documents, communication history, and regulatory requirements.",
  model: "complex",
  input: orchestratorInput,
  output: orchestratorOutput,
  prompt: `You are the workflow orchestrator for a UK accountancy practice onboarding system.

Your job is to determine the single best next action to advance a client onboarding case.

The onboarding pipeline has these stages (in order):
lead → service_selection → pricing_agreed → company_verified → kyc_cdd → risk_assessed →
auth_letter_signed → engagement_signed → clearance_requested → handover → ledger_connected →
reviews_in_progress → docs_complete → compliance_passed → tasks_created → completed

Your decision criteria:
1. Are all compliance gates for the current stage passed? If not, trigger the relevant agent or request documents.
2. Is there a pending checklist item blocking progress? If so, identify what to do.
3. Has sufficient time passed since the last communication? Consider chasing.
4. Are all required documents in place? If not, request them.
5. Have all regulatory requirements been met for the current stage?

Key rules:
- NEVER advance to compliance_passed without all gates passed.
- NEVER advance past kyc_cdd without KYC passed.
- For limited companies: ALWAYS verify on Companies House before KYC.
- For high-risk clients: flag hold until ComplianceOfficer reviews.

Return the single best next action with clear reasoning.`,
  validators: [
    {
      name: "blockers-require-hold",
      validate: (o) =>
        o.blockers.length > 0 && o.nextAction !== "hold" && o.nextAction !== "request_document"
          ? "Blockers present but action is not hold or request_document"
          : true,
    },
    {
      name: "trigger-agent-has-name",
      validate: (o) =>
        o.nextAction === "trigger_agent" && !o.agentToTrigger
          ? "trigger_agent action requires agentToTrigger"
          : true,
    },
    {
      name: "advance-has-target",
      validate: (o) =>
        o.nextAction === "advance_status" && !o.targetStatus
          ? "advance_status requires targetStatus"
          : true,
    },
  ],
  confidence: { threshold: 0.8 },
  hitl: { kind: "below_threshold", assignedRole: "Manager" },
});

export type OrchestratorInput = z.infer<typeof orchestratorInput>;
export type OrchestratorOutput = z.infer<typeof orchestratorOutput>;
