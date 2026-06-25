import { notFound } from "next/navigation";
import Link from "next/link";
import { getCaseDetail, listDocuments, getMissingDocuments, can } from "@gns/core";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import {
  recordUploadAction,
  verifyDocumentAction,
  overrideClassificationAction,
} from "./actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  id_document: "ID Document",
  proof_of_address: "Proof of Address",
  bank_statement: "Bank Statement",
  vat_return: "VAT Return",
  payroll_record: "Payroll / PAYE",
  accounts: "Accounts",
  tax_return: "Tax Return",
  company_formation: "Company Formation",
  contract: "Contract",
  other: "Other",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  received: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";

export default async function DocumentCenterPage({
  params,
}: {
  params: { id: string };
}) {
  const session = requireSession();

  let detail: Awaited<ReturnType<typeof getCaseDetail>>;
  try {
    detail = await getCaseDetail(session, params.id);
  } catch {
    notFound();
  }

  const [docs, gaps] = await Promise.all([
    listDocuments(session, params.id).catch(() => []),
    getMissingDocuments(session, params.id).catch(() => null),
  ]);

  const { case: c, client, checklist } = detail;
  const canVerify = can(session, "verify_documents");
  const canUpload = can(session, "upload_documents");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/staff/cases/${c.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {c.reference}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Document Centre</h1>
          <p className="text-sm text-muted-foreground">{client?.name ?? "Client"}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-muted px-3 py-1">
            {docs.length} uploaded
          </span>
          {gaps && (
            <span
              className={`rounded-full px-3 py-1 ${
                gaps.blocking.length === 0
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {gaps.blocking.length === 0
                ? "All required docs received"
                : `${gaps.blocking.length} required missing`}
            </span>
          )}
        </div>
      </div>

      {/* Missing documents panel */}
      {gaps && gaps.blocking.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-medium text-amber-800">Missing required documents</h2>
          <ul className="mt-3 space-y-1">
            {gaps.blocking.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {item.label}
                {item.category && (
                  <span className="text-xs text-amber-500">
                    ({CATEGORY_LABELS[item.category] ?? item.category})
                  </span>
                )}
              </li>
            ))}
          </ul>
          {gaps.nonBlocking.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-amber-600 hover:underline">
                {gaps.nonBlocking.length} optional items also pending
              </summary>
              <ul className="mt-2 space-y-1 pl-4">
                {gaps.nonBlocking.map((item) => (
                  <li key={item.id} className="text-sm text-amber-600">
                    {item.label}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* Uploaded documents list */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Uploaded documents ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No documents uploaded yet. Use the form below to record an upload.
          </p>
        ) : (
          <div className="mt-3 divide-y">
            {docs.map((doc) => {
              const cls = (doc as { latestClassification: { id: string; category: string; confidence: string | null; needsReview: boolean } | null }).latestClassification;
              return (
                <div key={doc.id} className="flex items-start justify-between py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{doc.label}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGES[doc.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {doc.status}
                      </span>
                      <span>{CATEGORY_LABELS[doc.category] ?? doc.category}</span>
                      {doc.mimeType && <span>{doc.mimeType}</span>}
                      {doc.fileSize && (
                        <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                      )}
                    </div>
                    {cls && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          AI: {CATEGORY_LABELS[cls.category] ?? cls.category}
                          {cls.confidence ? ` (${(Number(cls.confidence) * 100).toFixed(0)}%)` : ""}
                        </span>
                        {cls.needsReview && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                            needs review
                          </span>
                        )}
                        {canVerify && cls.needsReview && (
                          <form action={overrideClassificationAction} className="inline-flex gap-1">
                            <input type="hidden" name="documentId" value={doc.id} />
                            <input type="hidden" name="classificationId" value={cls.id} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <select name="category" className="rounded border px-1 py-0.5 text-xs">
                              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                                <option key={v} value={v} selected={v === cls.category}>
                                  {l}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded bg-primary px-2 py-0.5 text-xs text-white"
                            >
                              Confirm
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                  {canVerify && doc.status !== "verified" && (
                    <form action={verifyDocumentAction}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="caseId" value={c.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Verify
                      </Button>
                    </form>
                  )}
                  {doc.status === "verified" && (
                    <span className="text-xs font-medium text-green-700">✓ Verified</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Upload form (dev mode: records metadata directly; real: use signed URL flow) */}
      {canUpload && (
        <section className="rounded-lg border p-5">
          <h2 className="font-medium">Record document upload</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            In production the browser uploads to Supabase Storage directly via signed URL.
            This form records metadata for a document you&apos;ve already uploaded.
          </p>
          <form action={recordUploadAction} className="mt-4 space-y-3">
            <input type="hidden" name="caseId" value={c.id} />
            <input type="hidden" name="entityId" value={c.entityId} />
            <input type="hidden" name="clientId" value={c.clientId} />
            <label className="block text-sm">
              Document label
              <input name="label" required className={field} placeholder="John Smith — Passport" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Category
                <select name="category" className={field}>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Link to checklist item (optional)
                <select name="checklistItemId" className={field}>
                  <option value="">— none —</option>
                  {checklist
                    .filter((i) => i.status === "pending")
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                MIME type
                <input
                  name="mimeType"
                  className={field}
                  placeholder="application/pdf"
                  defaultValue="application/pdf"
                />
              </label>
              <label className="text-sm">
                File size (bytes)
                <input name="fileSize" type="number" className={field} placeholder="102400" />
              </label>
            </div>
            <Button type="submit" size="sm">
              Record upload
            </Button>
          </form>
        </section>
      )}

      {/* Checklist summary */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">
          Checklist ({checklist.filter((i) => i.status !== "pending").length}/{checklist.length}{" "}
          items done)
        </h2>
        <ul className="mt-3 divide-y">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className={item.status !== "pending" ? "line-through text-muted-foreground" : ""}>
                {item.label}
                {item.required ? "" : " (optional)"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_BADGES[item.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {item.status}
              </span>
            </li>
          ))}
          {checklist.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">No checklist items.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
