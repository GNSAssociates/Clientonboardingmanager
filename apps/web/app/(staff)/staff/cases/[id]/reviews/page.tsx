import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getReviewSummary, createReviewTask, startReview, signOffReview } from "@gns/core";
import { revalidatePath } from "next/cache";

const REVIEW_TYPES = [
  { value: "bookkeeping", label: "Bookkeeping" },
  { value: "vat", label: "VAT" },
  { value: "paye", label: "PAYE" },
  { value: "cis", label: "CIS" },
  { value: "accounts", label: "Annual Accounts" },
  { value: "trial_balance", label: "Trial Balance" },
  { value: "self_assessment", label: "Self Assessment" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  findings_raised: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  signed_off: "bg-emerald-100 text-emerald-700",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-50 text-blue-600",
  warning: "bg-yellow-50 text-yellow-700",
  error: "bg-red-50 text-red-700",
  critical: "bg-red-100 text-red-900 font-semibold",
};

async function createReviewAction(formData: FormData) {
  "use server";
  const { getSession: gs } = await import("@/lib/auth/session");
  const session = gs();
  if (!session) throw new Error("Unauthorized");
  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const clientId = formData.get("clientId") as string;
  const reviewType = formData.get("reviewType") as string;
  const period = (formData.get("period") as string) || undefined;
  await createReviewTask(session, {
    entityId,
    caseId,
    clientId,
    reviewType: reviewType as "bookkeeping",
    period,
  });
  revalidatePath(`/staff/cases/${caseId}/reviews`);
}

async function startReviewAction(formData: FormData) {
  "use server";
  const { getSession: gs } = await import("@/lib/auth/session");
  const session = gs();
  if (!session) throw new Error("Unauthorized");
  const reviewTaskId = formData.get("reviewTaskId") as string;
  const caseId = formData.get("caseId") as string;
  await startReview(session, reviewTaskId);
  revalidatePath(`/staff/cases/${caseId}/reviews`);
}

async function signOffAction(formData: FormData) {
  "use server";
  const { getSession: gs } = await import("@/lib/auth/session");
  const session = gs();
  if (!session) throw new Error("Unauthorized");
  const reviewTaskId = formData.get("reviewTaskId") as string;
  const caseId = formData.get("caseId") as string;
  const summary = (formData.get("summary") as string) || undefined;
  await signOffReview(session, { reviewTaskId, summary });
  revalidatePath(`/staff/cases/${caseId}/reviews`);
}

export default async function ReviewsPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return notFound();

  const entityId = session.entityIds[0];
  if (!entityId) return notFound();

  const summary = await getReviewSummary(session, params.id);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {summary.tasks.length} review{summary.tasks.length !== 1 ? "s" : ""} ·{" "}
            {summary.tasks.filter((t) => t.status === "signed_off").length} signed off
          </p>
        </div>
      </div>

      {/* Create Review Form */}
      <form
        action={createReviewAction}
        className="border rounded-lg p-4 space-y-3 bg-gray-50"
      >
        <input type="hidden" name="caseId" value={params.id} />
        <input type="hidden" name="entityId" value={entityId} />
        <input type="hidden" name="clientId" value="" />
        <p className="text-sm font-medium">Create Review Task</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Review Type</label>
            <select name="reviewType" className="border rounded px-2 py-1 text-sm">
              {REVIEW_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period (optional)</label>
            <input
              type="text"
              name="period"
              placeholder="e.g. 2024-Q1"
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </form>

      {/* Review list */}
      {summary.tasks.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-gray-400">
          No review tasks yet.
        </div>
      )}

      {summary.tasks.map((task) => (
        <div key={task.id} className="border rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium capitalize">
                {task.reviewType.replace(/_/g, " ")}
                {task.period ? ` — ${task.period}` : ""}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {task.findings.length} finding{task.findings.length !== 1 ? "s" : ""}
                {task.assignedTo ? ` · Assigned to ${task.assignedTo.slice(0, 8)}` : ""}
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {task.status.replace(/_/g, " ")}
            </span>
          </div>

          {task.summary && (
            <p className="text-sm text-gray-600 italic">{task.summary}</p>
          )}

          {task.findings.length > 0 && (
            <ul className="space-y-2">
              {task.findings.map((f) => (
                <li
                  key={f.id}
                  className={`rounded px-3 py-2 text-xs ${SEVERITY_COLORS[f.severity] ?? ""}`}
                >
                  <span className="font-medium capitalize">[{f.severity}]</span>{" "}
                  <span className="font-medium">{f.category}</span>: {f.description}
                  {f.recommendedAction && (
                    <p className="mt-0.5 text-gray-500">→ {f.recommendedAction}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 flex-wrap">
            {task.status === "pending" && (
              <form action={startReviewAction}>
                <input type="hidden" name="reviewTaskId" value={task.id} />
                <input type="hidden" name="caseId" value={params.id} />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  Start Review
                </button>
              </form>
            )}
            {(task.status === "in_progress" || task.status === "findings_raised") && (
              <form action={signOffAction} className="flex gap-2 items-center">
                <input type="hidden" name="reviewTaskId" value={task.id} />
                <input type="hidden" name="caseId" value={params.id} />
                <input
                  type="text"
                  name="summary"
                  placeholder="Sign-off summary..."
                  className="border rounded px-2 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
                >
                  Sign Off
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
