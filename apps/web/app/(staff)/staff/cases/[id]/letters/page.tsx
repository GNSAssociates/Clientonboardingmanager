import { notFound } from "next/navigation";
import Link from "next/link";
import { getCaseDetail, listGeneratedDocsForCase, can } from "@gns/core";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { generateLetterAction, sendForSigningAction, voidEnvelopeAction } from "./actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  signed: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  voided: "bg-muted text-muted-foreground line-through",
  expired: "bg-amber-100 text-amber-700",
};

export default async function LettersPage({ params }: { params: { id: string } }) {
  const session = requireSession();

  let detail: Awaited<ReturnType<typeof getCaseDetail>>;
  try {
    detail = await getCaseDetail(session, params.id);
  } catch {
    notFound();
  }

  const { case: c, client } = detail;

  let generatedData: Awaited<ReturnType<typeof listGeneratedDocsForCase>> | null = null;
  try {
    generatedData = await listGeneratedDocsForCase(session, params.id);
  } catch {
    // DB not available — show empty state
  }

  const canGenerate = can(session, "generate_documents");
  const canSign = can(session, "send_esign");

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/staff/cases/${c.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {c.reference}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Letters & E-sign</h1>
          <p className="text-sm text-muted-foreground">{client?.name ?? "Client"}</p>
        </div>
      </div>

      {/* Generated documents list */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Generated letters</h2>
        {!generatedData || generatedData.docs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No letters generated yet.</p>
        ) : (
          <div className="mt-3 divide-y">
            {generatedData.docs.map((doc) => {
              const envelope = generatedData?.envelopes.find(
                (e) => e.generatedDocId === doc.id,
              );
              return (
                <div key={doc.id} className="flex items-start justify-between py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium capitalize">
                      {doc.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generated {new Date(doc.generatedAt).toLocaleDateString("en-GB")}
                    </p>
                    {envelope && (
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            STATUS_BADGES[envelope.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {envelope.status}
                        </span>
                        {envelope.provider && (
                          <span className="text-muted-foreground">{envelope.provider}</span>
                        )}
                        {envelope.sentAt && (
                          <span className="text-muted-foreground">
                            Sent {new Date(envelope.sentAt).toLocaleDateString("en-GB")}
                          </span>
                        )}
                        {envelope.signedAt && (
                          <span className="text-green-700">
                            ✓ Signed {new Date(envelope.signedAt).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canSign && !envelope && (
                      <form action={sendForSigningAction} className="flex gap-1">
                        <input type="hidden" name="caseId" value={c.id} />
                        <input type="hidden" name="entityId" value={c.entityId} />
                        <input type="hidden" name="generatedDocId" value={doc.id} />
                        <input name="signerName" placeholder="Signer name" className="rounded border px-2 py-1 text-xs" required />
                        <input name="signerEmail" type="email" placeholder="email@example.com" className="rounded border px-2 py-1 text-xs" required />
                        <Button type="submit" size="sm" variant="outline">
                          Send for signature
                        </Button>
                      </form>
                    )}
                    {canSign && envelope && ["sent", "viewed"].includes(envelope.status) && (
                      <form action={voidEnvelopeAction}>
                        <input type="hidden" name="envelopeId" value={envelope.id} />
                        <input type="hidden" name="caseId" value={c.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                          Void
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Generate new letter */}
      {canGenerate && (
        <section className="rounded-lg border p-5">
          <h2 className="font-medium">Generate new letter</h2>
          <form action={generateLetterAction} className="mt-4 space-y-3">
            <input type="hidden" name="caseId" value={c.id} />
            <input type="hidden" name="entityId" value={c.entityId} />
            <input type="hidden" name="clientId" value={c.clientId} />
            <input type="hidden" name="reference" value={c.reference} />
            <input type="hidden" name="clientName" value={client?.name ?? ""} />
            <input type="hidden" name="clientType" value={client?.type ?? ""} />
            <input type="hidden" name="clientCompanyNumber" value={client?.companyNumber ?? ""} />

            <label className="block text-sm">
              Letter type
              <select name="type" required className={field}>
                <option value="auth_letter">Authority to Act</option>
                <option value="engagement_letter">Engagement Letter</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Contact name
                <input name="contactName" required className={field} placeholder="John Smith" />
              </label>
              <label className="text-sm">
                Contact email
                <input name="contactEmail" type="email" className={field} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Practice name (entity)
                <input name="entityLegalName" required className={field} placeholder="GNS Associates Ltd" />
              </label>
              <label className="text-sm">
                Signatory name
                <input name="entitySignatory" required className={field} placeholder="A N Other FCA" />
              </label>
            </div>

            <label className="block text-sm">
              Practice address
              <input name="entityAddress" className={field} placeholder="123 High Street, London, EC1A 1BB" />
            </label>

            <label className="block text-sm">
              Agreed annual fees (£)
              <input name="feesTotal" className={field} placeholder="e.g. 3,600" />
            </label>

            <Button type="submit" size="sm">
              Generate letter
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
