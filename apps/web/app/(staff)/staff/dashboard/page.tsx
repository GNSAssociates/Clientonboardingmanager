import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getPendingApprovals, getAgentRunsForCase } from "@gns/core";

export default async function StaffDashboard() {
  const session = getSession();
  if (!session) return notFound();

  const entityId = session.entityIds[0];
  if (!entityId) return notFound();

  const pendingApprovals = await getPendingApprovals(session, entityId);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Staff Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome{session.displayName ? `, ${session.displayName}` : ""}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/staff/cases"
          className="border rounded-lg p-5 hover:bg-gray-50 transition-colors"
        >
          <p className="text-3xl font-bold">—</p>
          <p className="text-sm text-gray-500 mt-1">Active cases</p>
        </Link>
        <Link
          href="/staff/approvals"
          className={`border rounded-lg p-5 hover:bg-gray-50 transition-colors ${pendingApprovals.length > 0 ? "border-yellow-400 bg-yellow-50" : ""}`}
        >
          <p className="text-3xl font-bold">{pendingApprovals.length}</p>
          <p className="text-sm text-gray-500 mt-1">AI approvals pending</p>
        </Link>
        <Link
          href="/staff/cases"
          className="border rounded-lg p-5 hover:bg-gray-50 transition-colors"
        >
          <p className="text-3xl font-bold">—</p>
          <p className="text-sm text-gray-500 mt-1">Open review tasks</p>
        </Link>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/staff/cases", label: "All Cases" },
          { href: "/staff/approvals", label: "AI Queue" },
          { href: "/staff/cases", label: "Clearance" },
          { href: "/staff/cases", label: "Documents" },
        ].map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="border rounded px-4 py-3 text-sm text-center hover:bg-gray-50"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {pendingApprovals.length > 0 && (
        <div className="border rounded-lg p-5 border-yellow-300 bg-yellow-50">
          <h2 className="text-base font-semibold mb-2">Action required</h2>
          <p className="text-sm text-yellow-800">
            {pendingApprovals.length} AI output{pendingApprovals.length !== 1 ? "s" : ""} awaiting your review.{" "}
            <Link href="/staff/approvals" className="font-medium underline">
              Review now
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
