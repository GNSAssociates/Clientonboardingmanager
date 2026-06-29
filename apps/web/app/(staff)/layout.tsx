'use client';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Users, CheckSquare, ClipboardList, ShieldCheck, Plus, LogOut } from "lucide-react";

const FIRMS = [
  { slug: "gns",    label: "GNS Associates Ltd",    color: "#cc2229" },
  { slug: "llp",    label: "GNS Associates UK LLP", color: "#1e3a8a" },
  { slug: "galaxy", label: "Galaxy Accountants",    color: "#7c3aed" },
];

const NAV = [
  { href: "/staff/dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { href: "/staff",            label: "Cases",        icon: Users },
  { href: "/staff/tasks",      label: "Tasks",        icon: CheckSquare },
  { href: "/staff/reviews",    label: "Reviews",      icon: ClipboardList },
  { href: "/staff/compliance", label: "Compliance",   icon: ShieldCheck },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed h-full z-20">
        {/* Logo */}
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

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = path === item.href || (item.href !== "/staff/dashboard" && item.href !== "/staff" && path.startsWith(item.href));
            const dashActive = item.href === "/staff/dashboard" && path === "/staff/dashboard";
            const casesActive = item.href === "/staff" && (path === "/staff" || (path.startsWith("/staff/cases") && !path.startsWith("/staff/dashboard") && !path.startsWith("/staff/firms")));
            const isActive = dashActive || casesActive || (item.href !== "/staff/dashboard" && item.href !== "/staff" && active);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}>
                <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                {item.label}
              </Link>
            );
          })}

          {/* Firms section */}
          <div className="pt-4 pb-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Firms</p>
          </div>
          {FIRMS.map((f) => {
            const active = path.startsWith(`/staff/firms/${f.slug}`);
            return (
              <Link key={f.slug} href={`/staff/firms/${f.slug}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}>
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <span className="truncate">{f.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-gray-100 space-y-1">
          <Link href="/onboarding"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #cc2229, #1e3a8a)" }}>
            <Plus size={15} />
            New Onboarding
          </Link>
          <Link href="/dev-login"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <LogOut size={13} />
            Switch role
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
