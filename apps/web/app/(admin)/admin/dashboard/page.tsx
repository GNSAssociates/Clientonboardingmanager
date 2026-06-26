import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export default async function AdminDashboard() {
  const session = getSession();
  if (!session) return notFound();
  if (!session.isAdmin) return notFound();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform administration</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Entities</h2>
          <p className="text-sm text-gray-500">Manage GNS, LLP, GXY configurations</p>
          <Link href="/admin/entities" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
            Manage →
          </Link>
        </div>
        <div className="border rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Users</h2>
          <p className="text-sm text-gray-500">Manage staff roles and permissions</p>
          <Link href="/admin/users" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
            Manage →
          </Link>
        </div>
        <div className="border rounded-lg p-5">
          <h2 className="text-base font-semibold mb-1">Audit Log</h2>
          <p className="text-sm text-gray-500">All platform actions and decisions</p>
          <Link href="/admin/audit" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
            View →
          </Link>
        </div>
      </div>

      <div className="border rounded-lg divide-y">
        {[
          { href: "/admin/entities", label: "Entity configuration" },
          { href: "/admin/audit", label: "Audit log" },
          { href: "/staff/approvals", label: "AI approval queue" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <p className="text-sm font-medium">{link.label}</p>
            <span className="text-gray-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
