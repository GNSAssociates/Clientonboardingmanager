// NOTE: this layout wraps every /onboarding/* page, including the
// client-facing signing (/onboarding/engage/[token]) and document upload
// (/onboarding/documents/[token]) pages — so the staff-only Back/Home bar is
// NOT added here. It is rendered directly on the staff-only wizard steps
// instead (see OnboardingHeader in ./_onboarding-header.tsx, used by
// onboarding/page.tsx, onboarding/services/page.tsx and
// onboarding/company/page.tsx) so external clients never see a "Home" link
// into the staff area.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-32 left-20 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
