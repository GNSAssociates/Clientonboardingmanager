/**
 * Client portal shell (A6 §2). Entity theming is applied via `data-entity`
 * (resolved from the signed-in client's entity in M1); defaults to GNS in M0.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-entity="GNS" className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold">GNS Associates</span>
          <span className="text-sm text-muted-foreground">Client Portal</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
