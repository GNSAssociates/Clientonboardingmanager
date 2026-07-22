'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ClipboardList, ShieldCheck, Handshake, UserSearch, FileText, LayoutTemplate } from "lucide-react";

const NAV = [
  { href: "/staff/dashboard",   label: "Dashboard",   Icon: LayoutDashboard },
  { href: "/staff/clients",     label: "Clients",     Icon: Users },
  { href: "/staff/clearance",   label: "Clearance",   Icon: Handshake },
  { href: "/staff/letters",     label: "Letters",     Icon: FileText },
  { href: "/staff/accountants", label: "Accountants", Icon: UserSearch },
  { href: "/staff/reviews",     label: "Reviews",     Icon: ClipboardList },
  { href: "/staff/compliance",  label: "Compliance",  Icon: ShieldCheck },
  { href: "/staff/templates",   label: "Templates",   Icon: LayoutTemplate },
];

const FIRMS = [
  { slug: "gns",    label: "GNS Associates Ltd",    color: "#cc2229" },
  { slug: "llp",    label: "GNS Associates UK LLP", color: "#1e3a8a" },
  { slug: "galaxy", label: "Galaxy Accountants",    color: "#7c3aed" },
];

export function StaffNav() {
  const path = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {NAV.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Icon size={16} className={active ? "text-blue-600" : "text-gray-400"} />
            {label}
          </Link>
        );
      })}

      <div className="pt-4 pb-1">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Firms</p>
      </div>

      {FIRMS.map((f) => {
        const active = path.startsWith(`/staff/firms/${f.slug}`);
        return (
          <Link
            key={f.slug}
            href={`/staff/firms/${f.slug}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
            <span className="truncate">{f.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
