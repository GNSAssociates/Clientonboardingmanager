import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { SessionBar } from "@/components/session-bar";

/** Staff portal shell (A6 §3) — left nav established; screens built M2/M9/M10. */
const nav = [
  { href: "/staff", label: "Cases" },
  { href: "/staff/tasks", label: "Tasks" },
  { href: "/staff/reviews", label: "Reviews" },
  { href: "/staff/compliance", label: "Compliance" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  return (
    <div data-entity="GNS" className="flex min-h-screen">
      <aside className="w-56 border-r p-4">
        <p className="px-2 text-sm font-semibold">GNS · Staff</p>
        <nav className="mt-4 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <SessionBar session={session} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
