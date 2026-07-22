import { notFound } from "next/navigation";
import Image from "next/image";
import { DEV_PRESETS, isDevAuthEnabled } from "@/lib/auth/dev";
import { loginAs } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_META: Record<string, { icon: string; description: string }> = {
  Admin:             { icon: "⚡", description: "Full system access across all firms" },
  Partner:           { icon: "🏛️", description: "Senior partner — sign-off & compliance" },
  Manager:           { icon: "📊", description: "Manage cases, assign tasks, review work" },
  OnboardingStaff:   { icon: "🚀", description: "Create onboardings, send engagement links" },
  Reviewer:          { icon: "🔍", description: "Review accounts, VAT, payroll & tax" },
  ComplianceOfficer: { icon: "🛡️", description: "AML, KYC, risk assessments" },
  Client:            { icon: "👤", description: "Client portal access" },
};

export default function DevLoginPage() {
  if (!isDevAuthEnabled()) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo + branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 overflow-hidden border border-white/20">
            <Image src="/logos/gns.png" alt="GNS" width={48} height={48} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">GNS Associates</h1>
          <p className="text-sm text-white/50 mt-1">Staff Portal · Development Environment</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <p className="text-sm font-semibold text-white">Select your role to continue</p>
            <p className="text-xs text-white/40 mt-0.5">Issues a signed session cookie matching production auth</p>
          </div>

          <div className="p-3 space-y-1">
            {DEV_PRESETS.map((preset) => {
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

        {/* Footer */}
        <p className="text-center text-xs text-white/20 mt-6">
          GNS Associates UK LLP · OC428532 · Not for production use
        </p>
      </div>
    </div>
  );
}
