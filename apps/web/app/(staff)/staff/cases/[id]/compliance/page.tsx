import { notFound } from "next/navigation";
import Link from "next/link";
import { getCaseDetail, getComplianceSummary, can } from "@gns/core";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import {
  verifyCompanyAction,
  initiateKycAction,
  recordCddAction,
  approveGateAction,
} from "./actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";

const GATE_LABELS: Record<string, string> = {
  company_verified: "Company Verified (CH)",
  kyc_passed: "KYC Passed",
  cdd_complete: "CDD Complete",
  risk_assessed: "Risk Assessed",
  sanctions_clear: "Sanctions Clear",
};

const GATE_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  overridden: "bg-amber-100 text-amber-700",
};

const KYC_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700",
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default async function CompliancePage({ params }: { params: { id: string } }) {
  const session = requireSession();

  let detail: Awaited<ReturnType<typeof getCaseDetail>>;
  try {
    detail = await getCaseDetail(session, params.id);
  } catch {
    notFound();
  }

  const { case: c, client } = detail;

  let summary: Awaited<ReturnType<typeof getComplianceSummary>> | null = null;
  try {
    summary = await getComplianceSummary(session, params.id);
  } catch {
    // DB not available — show empty state
  }

  const canCdd = can(session, "perform_cdd");
  const canApprove = can(session, "approve_ai_compliance");

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/staff/cases/${c.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {c.reference}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Compliance & KYC/AML</h1>
          <p className="text-sm text-muted-foreground">{client?.name ?? "Client"}</p>
        </div>
      </div>

      {/* Compliance gates summary */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Compliance gates</h2>
        {!summary || summary.gates.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No gates recorded yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.gates.map((gate) => (
              <div key={gate.id} className="flex flex-col gap-1 rounded-md border p-3">
                <span className="text-xs font-medium">{GATE_LABELS[gate.gateName] ?? gate.gateName}</span>
                <span
                  className={`self-start rounded-full px-2 py-0.5 text-xs font-medium ${
                    GATE_STATUS_CLASSES[gate.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {gate.status}
                </span>
                {canApprove && gate.status === "pending" && (
                  <form action={approveGateAction} className="mt-1">
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="entityId" value={c.entityId} />
                    <input type="hidden" name="gateName" value={gate.gateName} />
                    <Button type="submit" size="sm" variant="outline" className="h-6 text-xs">
                      Approve
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Companies House */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Companies House verification</h2>
        {summary?.chRecord ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Company name</dt>
            <dd>{summary.chRecord.companyName}</dd>
            <dt className="text-muted-foreground">Number</dt>
            <dd>{summary.chRecord.companyNumber}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className={summary.chRecord.companyStatus === "active" ? "text-green-700" : "text-red-700"}>
              {summary.chRecord.companyStatus}
            </dd>
            <dt className="text-muted-foreground">Incorporated</dt>
            <dd>{summary.chRecord.incorporatedOn ?? "—"}</dd>
          </dl>
        ) : canCdd ? (
          <form action={verifyCompanyAction} className="mt-3 space-y-3">
            <input type="hidden" name="caseId" value={c.id} />
            <input type="hidden" name="entityId" value={c.entityId} />
            <input type="hidden" name="clientId" value={c.clientId} />
            <label className="block text-sm">
              Company number
              <input
                name="companyNumber"
                required
                className={field}
                placeholder="e.g. 12345678"
                defaultValue={client?.companyNumber ?? ""}
              />
            </label>
            <Button type="submit" size="sm">
              Verify on Companies House
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Not yet verified.</p>
        )}
      </section>

      {/* KYC */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">KYC / Identity checks</h2>
        {summary && summary.kycChecks.length > 0 ? (
          <div className="mt-3 divide-y">
            {summary.kycChecks.map((check) => (
              <div key={check.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{check.provider}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{check.checkType}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    KYC_STATUS_CLASSES[check.status] ?? "bg-muted"
                  }`}
                >
                  {check.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          canCdd && (
            <form action={initiateKycAction} className="mt-3 space-y-3">
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="entityId" value={c.entityId} />
              <input type="hidden" name="clientId" value={c.clientId} />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Subject name
                  <input name="subjectName" required className={field} placeholder="John Smith" />
                </label>
                <label className="text-sm">
                  Subject email
                  <input name="subjectEmail" type="email" required className={field} />
                </label>
              </div>
              <Button type="submit" size="sm">
                Initiate KYC check (Amiqus)
              </Button>
            </form>
          )
        )}
        {!summary?.kycChecks.length && !canCdd && (
          <p className="mt-2 text-sm text-muted-foreground">No KYC checks initiated.</p>
        )}
      </section>

      {/* CDD */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Customer Due Diligence (CDD)</h2>
        {summary?.cdd ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Outcome</dt>
            <dd className="capitalize">{summary.cdd.outcome}</dd>
            <dt className="text-muted-foreground">PEP flag</dt>
            <dd>{summary.cdd.pepFlag ? "Yes ⚠" : "No"}</dd>
            <dt className="text-muted-foreground">Sanctions flag</dt>
            <dd>{summary.cdd.sanctionsFlag ? "Yes ⚠" : "No"}</dd>
            <dt className="text-muted-foreground">Adverse media</dt>
            <dd>{summary.cdd.adverseMediaFlag ? "Yes ⚠" : "No"}</dd>
            <dt className="text-muted-foreground">Reviewed by</dt>
            <dd>{summary.cdd.reviewedBy ?? "—"}</dd>
            <dt className="text-muted-foreground">Reviewed at</dt>
            <dd>
              {summary.cdd.reviewedAt
                ? new Date(summary.cdd.reviewedAt).toLocaleDateString("en-GB")
                : "—"}
            </dd>
          </dl>
        ) : canCdd ? (
          <form action={recordCddAction} className="mt-3 space-y-3">
            <input type="hidden" name="caseId" value={c.id} />
            <input type="hidden" name="entityId" value={c.entityId} />
            <input type="hidden" name="clientId" value={c.clientId} />
            <label className="block text-sm">
              CDD outcome
              <select name="outcome" required className={field}>
                <option value="standard">Standard</option>
                <option value="enhanced">Enhanced</option>
                <option value="simplified">Simplified</option>
                <option value="refused">Refused</option>
              </select>
            </label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="pepFlag" /> PEP flag
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sanctionsFlag" /> Sanctions flag
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="adverseMediaFlag" /> Adverse media
              </label>
            </div>
            <label className="block text-sm">
              Source of funds
              <input name="sourceOfFunds" className={field} placeholder="Salary / business profits / etc." />
            </label>
            <label className="block text-sm">
              Business activity
              <input name="businessActivity" className={field} />
            </label>
            <label className="block text-sm">
              Notes
              <textarea name="notes" rows={2} className={field} />
            </label>
            <Button type="submit" size="sm">
              Record CDD decision
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No CDD record yet.</p>
        )}
      </section>

      {/* Risk assessment */}
      {summary?.risk && (
        <section className="rounded-lg border p-5">
          <h2 className="font-medium">Risk assessment</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Risk rating</dt>
            <dd
              className={
                summary.risk.riskRating === "high"
                  ? "font-semibold text-red-700"
                  : summary.risk.riskRating === "medium"
                  ? "font-semibold text-amber-700"
                  : "font-semibold text-green-700"
              }
            >
              {summary.risk.riskRating.toUpperCase()}
            </dd>
            {summary.risk.overallScore && (
              <>
                <dt className="text-muted-foreground">Score</dt>
                <dd>{summary.risk.overallScore} / 100</dd>
              </>
            )}
            {summary.risk.reasoning && (
              <>
                <dt className="text-muted-foreground">Reasoning</dt>
                <dd className="col-span-1 text-xs">{summary.risk.reasoning}</dd>
              </>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
