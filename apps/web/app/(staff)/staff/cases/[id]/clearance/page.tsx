import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@gns/db";
import { getClearanceRequestByCaseId, listFollowupsByCase } from "@gns/db";
import { ClearanceTracker } from "./_tracker";
import type { ClearanceRequest, DocItem } from "./_tracker";

async function getCaseBasic(caseId: string) {
  const db = getDb();
  // We just need client name + company number — pull from onboarding links via case
  try {
    const rows = await db.execute(
      `SELECT c.name as client_name, c.company_number
       FROM onboarding_cases oc
       JOIN clients c ON c.id = oc.client_id
       WHERE oc.id = $1 LIMIT 1`,
      [caseId]
    ) as unknown as Array<{ client_name: string; company_number: string }>;
    const row = rows[0];
    return { clientName: row?.client_name ?? '', companyNumber: row?.company_number ?? '' };
  } catch {
    return { clientName: '', companyNumber: '' };
  }
}

export default async function ClearancePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return notFound();

  const entityId = session.entityIds[0];
  if (!entityId) return notFound();

  const caseId = params.id;
  const db = getDb();

  const [rawRequest, followups, caseInfo] = await Promise.all([
    db.transaction(tx => getClearanceRequestByCaseId(tx, caseId)),
    db.transaction(tx => listFollowupsByCase(tx, caseId, entityId)),
    getCaseBasic(caseId),
  ]);

  let request: ClearanceRequest | null = null;
  if (rawRequest) {
    const rd = (rawRequest.responseData ?? {}) as { docItems?: DocItem[] };
    request = {
      id: rawRequest.id,
      prevFirmName: rawRequest.prevFirmName,
      prevFirmEmail: rawRequest.prevFirmEmail ?? null,
      status: rawRequest.status,
      sentAt: rawRequest.sentAt ? rawRequest.sentAt.toISOString() : null,
      nextChaseAt: rawRequest.nextChaseAt ? rawRequest.nextChaseAt.toISOString() : null,
      followupCount: followups.length,
      docItems: rd.docItems ?? [],
      outcome: rawRequest.outcome ?? null,
    };
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/staff/cases/${caseId}`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to case
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Professional Clearance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ICAEW Code of Ethics R320.7 — {caseInfo.clientName || caseId.substring(0, 8).toUpperCase()}
            {caseInfo.companyNumber && ` · ${caseInfo.companyNumber}`}
          </p>
        </div>

        {request && (
          <div className="text-right text-xs text-gray-400 space-y-0.5">
            <p>Auto-chase every <strong className="text-gray-600">5 days</strong></p>
            <p className="text-gray-400">for outstanding documents</p>
          </div>
        )}
      </div>

      <ClearanceTracker
        caseId={caseId}
        entityId={entityId}
        clientName={caseInfo.clientName}
        companyNumber={caseInfo.companyNumber}
        request={request}
      />
    </div>
  );
}
