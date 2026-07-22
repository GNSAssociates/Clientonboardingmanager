import { z } from "zod";
import {
  withSession,
  insertAudit,
  insertKycCheck,
  updateKycCheck,
  listKycChecksByCase,
  insertCddRecord,
  updateCddRecord,
  getLatestCddRecord,
  insertRiskAssessment,
  updateRiskAssessment,
  getLatestRiskAssessment,
  insertSanctionsScreening,
  getLatestSanctionsScreening,
  upsertChRecord,
  getChRecordByCaseId,
  upsertComplianceGate,
  listComplianceGates,
  allGatesPassed,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";
import { NotFoundError } from "../errors";
import { emitEvent } from "../events";
import type { CompaniesHousePort, KycProvider } from "../ports";

/* ── input schemas ────────────────────────────────────────────────────────── */

export const verifyCompanySchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  companyNumber: z.string().min(1).max(20),
});

export const initiateKycSchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  subjectName: z.string().min(1),
  subjectEmail: z.string().email(),
  checks: z.array(z.string()).optional(),
});

export const recordCddSchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  outcome: z.enum(["standard", "enhanced", "simplified", "refused"]),
  pepFlag: z.boolean().default(false),
  sanctionsFlag: z.boolean().default(false),
  adverseMediaFlag: z.boolean().default(false),
  sourceOfFunds: z.string().optional(),
  sourceOfWealth: z.string().optional(),
  businessActivity: z.string().optional(),
  notes: z.string().optional(),
});

export const approveComplianceGateSchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  gateName: z.enum(["company_verified", "kyc_passed", "cdd_complete", "risk_assessed", "sanctions_clear"]),
  notes: z.string().optional(),
  override: z.boolean().default(false),
});

/* ── service functions ────────────────────────────────────────────────────── */

/**
 * Look up a company on Companies House, store the result, mark the
 * company_verified gate, and emit a domain event.
 */
export async function verifyCompany(
  session: AuthSession,
  rawInput: z.input<typeof verifyCompanySchema>,
  chProvider: CompaniesHousePort,
) {
  authorize(session, "perform_cdd");
  const input = verifyCompanySchema.parse(rawInput);

  const profile = await chProvider.getProfile(input.companyNumber);

  return withSession(session, async (tx) => {
    const record = await upsertChRecord(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      clientId: input.clientId,
      companyNumber: input.companyNumber,
      companyName: profile.name,
      companyStatus: profile.status,
      incorporatedOn: profile.incorporatedOn,
      registeredAddress: profile.registeredOffice as Record<string, unknown>,
      sicCodes: profile.sicCodes,
      rawResponse: profile as unknown as Record<string, unknown>,
      verifiedAt: new Date(),
      verifiedBy: session.userId,
    });

    await upsertComplianceGate(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      gateName: "company_verified",
      status: profile.status === "active" ? "passed" : "failed",
      notes: `Companies House: ${profile.status}`,
      passedBy: session.userId,
      passedAt: profile.status === "active" ? new Date() : undefined,
    });

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "compliance.company_verified",
      resourceType: "companies_house_record",
      resourceId: record.id,
      after: { companyNumber: input.companyNumber, status: profile.status },
    });

    await emitEvent(tx, {
      entityId: input.entityId,
      type: "compliance.company_verified",
      payload: { caseId: input.caseId, companyNumber: input.companyNumber, status: profile.status },
    });

    return record;
  });
}

/**
 * Initiate a KYC/AML check via the registered provider.
 */
export async function initiateKyc(
  session: AuthSession,
  rawInput: z.input<typeof initiateKycSchema>,
  kycProvider: KycProvider,
) {
  authorize(session, "perform_cdd");
  const input = initiateKycSchema.parse(rawInput);

  const { ref } = await kycProvider.initiate({
    name: input.subjectName,
    email: input.subjectEmail,
    checks: input.checks ?? ["identity_document", "aml_sanctions_pep"],
  });

  return withSession(session, async (tx) => {
    const check = await insertKycCheck(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      clientId: input.clientId,
      provider: kycProvider.provider,
      providerRef: ref,
      checkType: "standard",
      status: "in_progress",
      initiatedAt: new Date(),
      initiatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "compliance.kyc_initiated",
      resourceType: "kyc_check",
      resourceId: check.id,
      after: { ref, provider: kycProvider.provider },
    });

    await emitEvent(tx, {
      entityId: input.entityId,
      type: "compliance.kyc_initiated",
      payload: { caseId: input.caseId, checkId: check.id, ref },
    });

    return check;
  });
}

/**
 * Poll (or receive webhook) for KYC result and update the check record.
 */
export async function updateKycResult(
  session: AuthSession,
  checkId: string,
  caseId: string,
  entityId: string,
  kycProvider: KycProvider,
) {
  authorize(session, "perform_cdd");

  return withSession(session, async (tx) => {
    const checks = await listKycChecksByCase(tx, caseId);
    const check = checks.find((c) => c.id === checkId);
    if (!check) throw new NotFoundError(`KYC check not found: ${checkId}`);
    if (!check.providerRef) throw new NotFoundError("KYC check has no provider ref");

    const { status, result } = await kycProvider.getResult(check.providerRef);
    const newStatus = mapKycStatus(status);

    const updated = await updateKycCheck(tx, checkId, {
      status: newStatus,
      result: result as Record<string, unknown>,
      completedAt: newStatus === "passed" || newStatus === "failed" ? new Date() : undefined,
    });

    if (newStatus === "passed") {
      await upsertComplianceGate(tx, {
        entityId,
        caseId,
        gateName: "kyc_passed",
        status: "passed",
        passedBy: session.userId,
        passedAt: new Date(),
      });
    }

    await emitEvent(tx, {
      entityId,
      type: "compliance.kyc_updated",
      payload: { caseId, checkId, status: newStatus },
    });

    return updated;
  });
}

/**
 * Record a CDD (Customer Due Diligence) decision made by a Compliance Officer.
 */
export async function recordCdd(
  session: AuthSession,
  rawInput: z.input<typeof recordCddSchema>,
) {
  authorize(session, "perform_cdd");
  const input = recordCddSchema.parse(rawInput);

  return withSession(session, async (tx) => {
    const record = await insertCddRecord(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      clientId: input.clientId,
      outcome: input.outcome,
      pepFlag: input.pepFlag,
      sanctionsFlag: input.sanctionsFlag,
      adverseMediaFlag: input.adverseMediaFlag,
      sourceOfFunds: input.sourceOfFunds,
      sourceOfWealth: input.sourceOfWealth,
      businessActivity: input.businessActivity,
      notes: input.notes,
      reviewedBy: session.userId,
      reviewedAt: new Date(),
    });

    const gateStatus = input.outcome === "refused" ? "failed" : "passed";
    await upsertComplianceGate(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      gateName: "cdd_complete",
      status: gateStatus,
      passedBy: session.userId,
      passedAt: gateStatus === "passed" ? new Date() : undefined,
      notes: `Outcome: ${input.outcome}`,
    });

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "compliance.cdd_recorded",
      resourceType: "cdd_record",
      resourceId: record.id,
      after: { outcome: input.outcome, pepFlag: input.pepFlag, sanctionsFlag: input.sanctionsFlag },
    });

    await emitEvent(tx, {
      entityId: input.entityId,
      type: "compliance.cdd_recorded",
      payload: { caseId: input.caseId, outcome: input.outcome },
    });

    return record;
  });
}

/**
 * Approve (or fail) a named compliance gate — for AI-agent driven gates that
 * require human sign-off (ComplianceOfficer / Partner only).
 */
export async function approveComplianceGate(
  session: AuthSession,
  rawInput: z.input<typeof approveComplianceGateSchema>,
) {
  authorize(session, "approve_ai_compliance");
  const input = approveComplianceGateSchema.parse(rawInput);

  return withSession(session, async (tx) => {
    const gate = await upsertComplianceGate(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      gateName: input.gateName,
      status: input.override ? "overridden" : "passed",
      notes: input.notes,
      passedBy: session.userId,
      passedAt: new Date(),
    });

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "compliance.gate_approved",
      resourceType: "compliance_gate",
      resourceId: gate.id,
      after: { gateName: input.gateName, override: input.override },
    });

    const allPassed = await allGatesPassed(tx, input.caseId);
    if (allPassed) {
      await emitEvent(tx, {
        entityId: input.entityId,
        type: "compliance.all_gates_passed",
        payload: { caseId: input.caseId },
      });
    }

    return gate;
  });
}

/** Return the full compliance summary for a case: CH record, KYC checks, CDD, risk, gates. */
export async function getComplianceSummary(session: AuthSession, caseId: string) {
  authorize(session, "perform_cdd");

  return withSession(session, async (tx) => {
    const [chRecord, kycCheckList, cdd, risk, sanction, gates] = await Promise.all([
      getChRecordByCaseId(tx, caseId),
      listKycChecksByCase(tx, caseId),
      getLatestCddRecord(tx, caseId),
      getLatestRiskAssessment(tx, caseId),
      getLatestSanctionsScreening(tx, caseId),
      listComplianceGates(tx, caseId),
    ]);
    return { chRecord, kycChecks: kycCheckList, cdd, risk, sanction, gates };
  });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function mapKycStatus(
  s: string,
): "pending" | "in_progress" | "passed" | "failed" | "expired" {
  const m: Record<string, "pending" | "in_progress" | "passed" | "failed" | "expired"> = {
    passed: "passed",
    failed: "failed",
    expired: "expired",
    in_progress: "in_progress",
    pending: "pending",
  };
  return m[s] ?? "in_progress";
}
