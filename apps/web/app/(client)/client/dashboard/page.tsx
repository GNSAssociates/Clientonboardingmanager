import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export default async function ClientDashboard() {
  const session = getSession();
  if (!session) return notFound();

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Client Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome{session.displayName ? `, ${session.displayName}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-5">
          <h2 className="text-base font-semibold mb-2">Onboarding status</h2>
          <p className="text-sm text-gray-500">
            Your accountant is reviewing your documents and completing compliance checks.
            You&apos;ll be notified when action is needed from you.
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <h2 className="text-base font-semibold mb-2">Pending items</h2>
          <p className="text-sm text-gray-400">No items require your attention right now.</p>
        </div>
      </div>

      <div className="border rounded-lg divide-y">
        {[
          { href: "/client/documents", label: "My Documents", description: "Upload or view your documents" },
          { href: "/client/profile", label: "My Profile", description: "Review your contact and company details" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium">{link.label}</p>
              <p className="text-xs text-gray-400">{link.description}</p>
            </div>
            <span className="text-gray-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
