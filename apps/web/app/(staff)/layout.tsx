import Link from "next/link";
import Image from "next/image";
import { StaffNav } from "./_staff-nav";
import { getSession } from "@/lib/auth/session";
import { loginAs } from "@/app/dev-login/actions";
import { DEV_PRESETS } from "@/lib/auth/dev";

const ROLE_META: Record<string, { icon: string; description: string }> = {
  Admin:             { icon: "⚡", description: "Full system access across all firms" },
  Partner:           { icon: "🏛️", description: "Senior partner — sign-off & compliance" },
  Manager:           { icon: "📊", description: "Manage cases, assign tasks, review work" },
  OnboardingStaff:   { icon: "🚀", description: "Create onboardings, send engagement links" },
  Reviewer:          { icon: "🔍", description: "Review accounts, VAT, payroll & tax" },
  ComplianceOfficer: { icon: "🛡️", description: "AML, KYC, risk assessments" },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();

  if (!session) {
    const staffPresets = DEV_PRESETS.filter((p) => !p.isClient);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 overflow-hidden border border-white/20">
              <Image src="/logos/gns.png" alt="GNS" width={48} height={48} className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white">GNS Associates</h1>
            <p className="text-sm text-white/50 mt-1">Staff Portal — Sign in to continue</p>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <p className="text-sm font-semibold text-white">Select your role</p>
              <p className="text-xs text-white/40 mt-0.5">Issues a secure signed session for this browser</p>
            </div>
            <div className="p-3 space-y-1">
              {staffPresets.map((preset) => {
                const role = preset.roles[0] ?? "Admin";
                const meta = ROLE_META[role] ?? { icon: "👤", description: "" };
                return (
                  <form key={preset.label} action={loginAs}>
                    <input type="hidden" name="roles" value={preset.roles.join(",")} />
                    <button
                      type="submit"
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-white/10 group"
                    >
                      <span className="text-xl flex-shrink-0">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                          {preset.label}
                        </p>
                        <p className="text-xs text-white/40 truncate">{meta.description}</p>
                      </div>
                      <span className="text-xs text-white/20 font-mono flex-shrink-0 group-hover:text-white/40 transition-colors">
                        {role}
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          <p className="text-center text-xs text-white/20 mt-6">
            GNS Associates UK · Secure Staff Portal
          </p>
        </div>
      </div>
    );
  }

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

        {/* Nav — client component for active state */}
        <StaffNav />

        {/* Bottom actions */}
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
            href="/staff/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ↩ Switch role
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
