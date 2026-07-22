import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { StaffNav } from "./_staff-nav";
import { getSession } from "@/lib/auth/session";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed h-full z-20">
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative flex-shrink-0">
              <Image src="/logos/gns.png" alt="GNS" fill className="object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">GNS Associates</p>
              <p className="text-xs text-gray-400">Staff Portal</p>
            </div>
          </div>
        </div>

        <StaffNav />

        <div className="px-3 py-4 border-t border-gray-100 space-y-1">
          <Link
            href="/onboarding"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #cc2229, #1e3a8a)" }}
          >
            <span className="text-base">+</span>
            New Onboarding
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </aside>

      <div className="flex-1 ml-60">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
