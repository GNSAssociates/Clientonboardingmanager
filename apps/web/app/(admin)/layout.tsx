import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { SessionBar } from "@/components/session-bar";

/** Admin portal shell (A6 §4) — config screens built in M1/M10. */
const nav = [
  { href: "/admin", label: "Entities" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/users", label: "Users & Roles" },
  { href: "/admin/integrations", label: "Integrations" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r p-4">
        <p className="px-2 text-sm font-semibold">Admin</p>
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
