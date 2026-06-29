'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CheckSquare, ClipboardList, ShieldCheck, FileCheck } from "lucide-react";

const FIRMS = [
  { slug: "gns",    label: "GNS Associates Ltd",    color: "#cc2229" },
  { slug: "llp",    label: "GNS Associates UK LLP", color: "#1e3a8a" },
  { slug: "galaxy", label: "Galaxy Accountants",    color: "#7c3aed" },
];

export function StaffNav() {
  const path = usePathname();
  const active = (href: string, exact = false) =>
    exact ? path === href : path === href || path.startsWith(href + "/") || path.startsWith(href);

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col gap-1">

      {/* ── Primary actions ────────────────────────────────── */}
      <Link href="/onboarding"
        className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm transition-all ${
          active("/onboarding")
            ? "bg-red-600 text-white shadow-sm"
            : "bg-gradient-to-r from-red-600 to-blue-900 text-white hover:opacity-90 shadow-sm"
        }`}>
        <span className="text-lg leading-none">+</span>
        New Onboarding
      </Link>

      <Link href="/staff/clearance"
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
          active("/staff/clearance")
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
        }`}>
        <FileCheck size={16} className={active("/staff/clearance") ? "text-blue-600" : "text-gray-500"} />
        Professional Clearance
      </Link>

      {/* ── Divider ────────────────────────────────────────── */}
      <div className="my-1 h-px bg-gray-100" />

      {/* ── Secondary nav ──────────────────────────────────── */}
      {[
        { href: "/staff/dashboard",  label: "Dashboard",  Icon: LayoutDashboard, exact: true },
        { href: "/staff",            label: "Cases",       Icon: Users,           exact: true },
        { href: "/staff/tasks",      label: "Tasks",       Icon: CheckSquare },
        { href: "/staff/reviews",    label: "Reviews",     Icon: ClipboardList },
        { href: "/staff/compliance", label: "Compliance",  Icon: ShieldCheck },
      ].map(({ href, label, Icon, exact }) => {
        const isActive = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isActive ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}>
            <Icon size={15} className={isActive ? "text-gray-700" : "text-gray-400"} />
            {label}
          </Link>
        );
      })}

      {/* ── Firms ──────────────────────────────────────────── */}
      <div className="mt-3 mb-1">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Firms</p>
      </div>

      {FIRMS.map((f) => {
        const isActive = path.startsWith(`/staff/firms/${f.slug}`);
        return (
          <Link key={f.slug} href={`/staff/firms/${f.slug}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isActive ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}>
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
            <span className="truncate">{f.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
