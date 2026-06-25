import { and, desc, eq } from "drizzle-orm";
import type { Tx } from "../client";
import {
  cddRecords,
  companiesHouseRecords,
  complianceGates,
  kycChecks,
  riskAssessments,
  sanctionsScreenings,
} from "../schema/compliance";

/* ── type aliases ────────────────────────────────────────────────────────── */
export type CompaniesHouseRow = typeof companiesHouseRecords.$inferSelect;
export type NewCompaniesHouseRecord = typeof companiesHouseRecords.$inferInsert;
export type KycCheckRow = typeof kycChecks.$inferSelect;
export type NewKycCheck = typeof kycChecks.$inferInsert;
export type CddRecordRow = typeof cddRecords.$inferSelect;
export type NewCddRecord = typeof cddRecords.$inferInsert;
export type RiskAssessmentRow = typeof riskAssessments.$inferSelect;
export type NewRiskAssessment = typeof riskAssessments.$inferInsert;
export type SanctionsScreeningRow = typeof sanctionsScreenings.$inferSelect;
export type NewSanctionsScreening = typeof sanctionsScreenings.$inferInsert;
export type ComplianceGateRow = typeof complianceGates.$inferSelect;
export type NewComplianceGate = typeof complianceGates.$inferInsert;

/* ── companies_house_records ─────────────────────────────────────────────── */
export async function upsertChRecord(
  tx: Tx,
  data: NewCompaniesHouseRecord,
): Promise<CompaniesHouseRow> {
  const [row] = await tx
    .insert(companiesHouseRecords)
    .values(data)
    .onConflictDoUpdate({
      target: [companiesHouseRecords.caseId],
      set: {
        companyName: data.companyName,
        companyStatus: data.companyStatus,
        companyType: data.companyType,
        incorporatedOn: data.incorporatedOn,
        registeredAddress: data.registeredAddress,
        sicCodes: data.sicCodes,
        officers: data.officers,
        pscData: data.pscData,
        filingHistory: data.filingHistory,
        rawResponse: data.rawResponse,
        verifiedAt: data.verifiedAt,
        verifiedBy: data.verifiedBy,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("companies_house_records upsert returned no row");
  return row;
}

export async function getChRecordByCaseId(
  tx: Tx,
  caseId: string,
): Promise<CompaniesHouseRow | undefined> {
  const [row] = await tx
    .select()
    .from(companiesHouseRecords)
    .where(eq(companiesHouseRecords.caseId, caseId))
    .orderBy(desc(companiesHouseRecords.createdAt))
    .limit(1);
  return row;
}

/* ── kyc_checks ──────────────────────────────────────────────────────────── */
export async function insertKycCheck(tx: Tx, data: NewKycCheck): Promise<KycCheckRow> {
  const [row] = await tx.insert(kycChecks).values(data).returning();
  if (!row) throw new Error("kyc_checks insert returned no row");
  return row;
}

export async function updateKycCheck(
  tx: Tx,
  id: string,
  patch: Partial<NewKycCheck>,
): Promise<KycCheckRow> {
  const [row] = await tx
    .update(kycChecks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(kycChecks.id, id))
    .returning();
  if (!row) throw new Error("kyc_check update returned no row");
  return row;
}

export function listKycChecksByCase(tx: Tx, caseId: string): Promise<KycCheckRow[]> {
  return tx
    .select()
    .from(kycChecks)
    .where(eq(kycChecks.caseId, caseId))
    .orderBy(desc(kycChecks.createdAt));
}

/* ── cdd_records ─────────────────────────────────────────────────────────── */
export async function insertCddRecord(tx: Tx, data: NewCddRecord): Promise<CddRecordRow> {
  const [row] = await tx.insert(cddRecords).values(data).returning();
  if (!row) throw new Error("cdd_records insert returned no row");
  return row;
}

export async function updateCddRecord(
  tx: Tx,
  id: string,
  patch: Partial<NewCddRecord>,
): Promise<CddRecordRow> {
  const [row] = await tx
    .update(cddRecords)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(cddRecords.id, id))
    .returning();
  if (!row) throw new Error("cdd_record update returned no row");
  return row;
}

export async function getLatestCddRecord(
  tx: Tx,
  caseId: string,
): Promise<CddRecordRow | undefined> {
  const [row] = await tx
    .select()
    .from(cddRecords)
    .where(eq(cddRecords.caseId, caseId))
    .orderBy(desc(cddRecords.createdAt))
    .limit(1);
  return row;
}

/* ── risk_assessments ────────────────────────────────────────────────────── */
export async function insertRiskAssessment(
  tx: Tx,
  data: NewRiskAssessment,
): Promise<RiskAssessmentRow> {
  const [row] = await tx.insert(riskAssessments).values(data).returning();
  if (!row) throw new Error("risk_assessment insert returned no row");
  return row;
}

export async function updateRiskAssessment(
  tx: Tx,
  id: string,
  patch: Partial<NewRiskAssessment>,
): Promise<RiskAssessmentRow> {
  const [row] = await tx
    .update(riskAssessments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(riskAssessments.id, id))
    .returning();
  if (!row) throw new Error("risk_assessment update returned no row");
  return row;
}

export async function getLatestRiskAssessment(
  tx: Tx,
  caseId: string,
): Promise<RiskAssessmentRow | undefined> {
  const [row] = await tx
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.caseId, caseId))
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);
  return row;
}

/* ── sanctions_screenings ────────────────────────────────────────────────── */
export async function insertSanctionsScreening(
  tx: Tx,
  data: NewSanctionsScreening,
): Promise<SanctionsScreeningRow> {
  const [row] = await tx.insert(sanctionsScreenings).values(data).returning();
  if (!row) throw new Error("sanctions_screening insert returned no row");
  return row;
}

export async function getLatestSanctionsScreening(
  tx: Tx,
  caseId: string,
): Promise<SanctionsScreeningRow | undefined> {
  const [row] = await tx
    .select()
    .from(sanctionsScreenings)
    .where(eq(sanctionsScreenings.caseId, caseId))
    .orderBy(desc(sanctionsScreenings.createdAt))
    .limit(1);
  return row;
}

/* ── compliance_gates ────────────────────────────────────────────────────── */
export async function upsertComplianceGate(
  tx: Tx,
  data: NewComplianceGate,
): Promise<ComplianceGateRow> {
  const [row] = await tx
    .insert(complianceGates)
    .values(data)
    .onConflictDoUpdate({
      target: [complianceGates.caseId, complianceGates.gateName],
      set: {
        status: data.status,
        notes: data.notes,
        passedBy: data.passedBy,
        passedAt: data.passedAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("compliance_gate upsert returned no row");
  return row;
}

export function listComplianceGates(tx: Tx, caseId: string): Promise<ComplianceGateRow[]> {
  return tx
    .select()
    .from(complianceGates)
    .where(eq(complianceGates.caseId, caseId))
    .orderBy(desc(complianceGates.createdAt));
}

/** Returns true if all required gates for a case have status 'passed' or 'overridden'. */
export async function allGatesPassed(tx: Tx, caseId: string): Promise<boolean> {
  const gates = await listComplianceGates(tx, caseId);
  return (
    gates.length > 0 &&
    gates.every((g) => g.status === "passed" || g.status === "overridden")
  );
}
