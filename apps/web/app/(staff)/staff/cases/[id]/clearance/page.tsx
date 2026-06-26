import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCaseDetail, getClearanceSummary } from "@gns/core";
import {
  sendClearanceRequestAction,
  recordResponseAction,
  sendFollowupAction,
} from "./actions";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  chased: "bg-yellow-100 text-yellow-700",
  received: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  not_required: "bg-purple-100 text-purple-700",
  timed_out: "bg-orange-100 text-orange-800",
};

const OUTCOME_BADGE: Record<string, string> = {
  clear: "bg-green-100 text-green-700",
  issues_raised: "bg-yellow-100 text-yellow-700",
  no_response: "bg-gray-100 text-gray-600",
  refused: "bg-red-100 text-red-700",
};

export default async function ClearancePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return notFound();

  const entityId = session.entityIds[0];
  if (!entityId) return notFound();

  let detail: Awaited<ReturnType<typeof getCaseDetail>>;
  try {
    detail = await getCaseDetail(session, params.id);
  } catch {
    return notFound();
  }

  const { case: c, client } = detail;

  const summary = await getClearanceSummary(session, params.id, entityId);

  const activeRequest = summary.requests.find(
    (r) => r.status !== "received" && r.status !== "declined" && r.status !== "timed_out",
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a
            href={`/staff/cases/${params.id}`}
            className="text-sm text-gray-500 hover:underline"
          >
            &larr; Back to case
          </a>
          <h1 className="text-2xl font-bold mt-1">Professional Clearance</h1>
          <p className="text-sm text-gray-500 mt-1">{c.reference ?? params.id}</p>
        </div>
      </div>

      {/* Existing clearance requests */}
      {summary.requests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Clearance Requests</h2>
          {summary.requests.map((request) => (
            <div key={request.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{request.prevFirmName}</p>
                  {request.prevFirmEmail && (
                    <p className="text-sm text-gray-500">{request.prevFirmEmail}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[request.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {request.status.replace("_", " ")}
                  </span>
                  {request.outcome && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${OUTCOME_BADGE[request.outcome] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {request.outcome.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>

              {request.sentAt && (
                <p className="text-xs text-gray-400">
                  Sent: {new Date(request.sentAt).toLocaleDateString("en-GB")}
                  {request.nextChaseAt && request.status !== "received" && (
                    <> · Next chase: {new Date(request.nextChaseAt).toLocaleDateString("en-GB")}</>
                  )}
                </p>
              )}

              {request.responseNotes && (
                <div className="bg-gray-50 rounded p-2 text-sm text-gray-700">
                  <p className="font-medium text-xs text-gray-400 mb-1">Response notes</p>
                  {request.responseNotes}
                </div>
              )}

              {/* Followups list */}
              {request.followups.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500">
                    Follow-ups sent ({request.followups.length})
                  </p>
                  {request.followups.map((f) => (
                    <p key={f.id} className="text-xs text-gray-400">
                      Chase {f.chaseNumber} — {new Date(f.sentAt).toLocaleDateString("en-GB")}
                      {f.notes ? ` · ${f.notes}` : ""}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions for active requests */}
              {request.status !== "received" &&
                request.status !== "declined" &&
                request.status !== "timed_out" && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <form action={recordResponseAction} className="contents">
                      <input type="hidden" name="caseId" value={params.id} />
                      <input type="hidden" name="entityId" value={entityId} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="outcome" value="clear" />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                      >
                        Mark as Received — Clear
                      </button>
                    </form>
                    <form action={recordResponseAction} className="contents">
                      <input type="hidden" name="caseId" value={params.id} />
                      <input type="hidden" name="entityId" value={entityId} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="outcome" value="issues_raised" />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs rounded bg-yellow-600 text-white hover:bg-yellow-700"
                      >
                        Issues Raised
                      </button>
                    </form>
                    <form action={sendFollowupAction} className="contents">
                      <input type="hidden" name="caseId" value={params.id} />
                      <input type="hidden" name="entityId" value={entityId} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Send Chase
                      </button>
                    </form>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Send new clearance request */}
      {!activeRequest && (
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="text-lg font-semibold">Send Professional Clearance Request</h2>
          <p className="text-sm text-gray-500">
            Send a formal clearance request to the client&apos;s previous accountant per ICAEW
            Code of Ethics R320.7.
          </p>

          <form action={sendClearanceRequestAction} className="space-y-4">
            <input type="hidden" name="caseId" value={c.id} />
            <input type="hidden" name="entityId" value={entityId} />
            <input type="hidden" name="clientId" value={c.clientId} />
            <input type="hidden" name="clientName" value={client?.name ?? ""} />
            <input type="hidden" name="companyNumber" value={client?.companyNumber ?? ""} />
            <input type="hidden" name="entityLegalName" value="[Entity Legal Name]" />
            <input type="hidden" name="entityAddress" value="[Entity Address — configure in entity settings]" />
            <input type="hidden" name="entitySignatoryName" value={session.displayName ?? ""} />
            <input type="hidden" name="entityAmlSupervisor" value="ICAEW" />

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previous Firm Name *
                </label>
                <input
                  type="text"
                  name="prevFirmName"
                  required
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Smith &amp; Co Accountants"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previous Firm Email
                </label>
                <input
                  type="email"
                  name="prevFirmEmail"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="accounts@previousfirm.co.uk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Response Deadline (days)
                </label>
                <input
                  type="number"
                  name="responseDeadlineDays"
                  defaultValue="14"
                  min="7"
                  max="30"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previous Firm Address
                </label>
                <textarea
                  name="prevFirmAddress"
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 High Street, London, EC1A 1BB"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Send Clearance Request
            </button>
          </form>
        </div>
      )}

      {activeRequest && (
        <div className="border rounded-lg p-4 bg-blue-50 text-sm text-blue-700">
          A clearance request to <strong>{activeRequest.prevFirmName}</strong> is currently
          active (status: <strong>{activeRequest.status}</strong>). Complete or close it before
          sending a new one.
        </div>
      )}
    </div>
  );
}
