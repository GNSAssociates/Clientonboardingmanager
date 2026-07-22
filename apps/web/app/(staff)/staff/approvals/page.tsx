import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPendingApprovals, resolveHitlApproval } from "@gns/core";
import { revalidatePath } from "next/cache";

async function approveAction(formData: FormData) {
  "use server";
  const { getSession: gs } = await import("@/lib/auth/session");
  const session = gs();
  if (!session) throw new Error("Unauthorized");
  const approvalId = formData.get("approvalId") as string;
  const entityId = formData.get("entityId") as string;
  const decision = formData.get("decision") as "approved" | "rejected";
  const reviewerNotes = (formData.get("reviewerNotes") as string) || undefined;
  await resolveHitlApproval(session, { entityId, approvalId, decision, reviewerNotes });
  revalidatePath("/staff/approvals");
}

export default async function ApprovalsPage() {
  const session = getSession();
  if (!session) return notFound();

  const entityId = session.entityIds[0];
  if (!entityId) return notFound();

  const pending = await getPendingApprovals(session, entityId);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Approval Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length} pending approval{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {pending.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-gray-400">
          No pending approvals — all AI outputs have been reviewed.
        </div>
      )}

      {pending.map((approval) => (
        <div key={approval.id} className="border rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium capitalize">
                {approval.agentName.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Assigned to: <strong>{approval.assignedRole}</strong>
                {approval.caseId ? ` · Case ${approval.caseId.slice(0, 8)}` : ""}
                {approval.dueAt ? ` · Due ${new Date(approval.dueAt).toLocaleString("en-GB")}` : ""}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
              Awaiting review
            </span>
          </div>

          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs font-medium text-gray-400 mb-1">Proposed output</p>
            <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(approval.proposedOutput, null, 2)}
            </pre>
          </div>

          <form action={approveAction} className="flex flex-wrap gap-2 items-end">
            <input type="hidden" name="approvalId" value={approval.id} />
            <input type="hidden" name="entityId" value={approval.entityId} />
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reviewer notes (optional)
              </label>
              <input
                type="text"
                name="reviewerNotes"
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Add notes..."
              />
            </div>
            <button
              type="submit"
              name="decision"
              value="approved"
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Approve
            </button>
            <button
              type="submit"
              name="decision"
              value="rejected"
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Reject
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
