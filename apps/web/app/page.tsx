import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Landing / portal selector (placeholder until auth lands in M1).
 * Demonstrates the three portal route groups and entity theming.
 */
const portals = [
  { href: "/client", label: "Client Portal", desc: "Sign up, upload documents, sign letters." },
  { href: "/staff", label: "Staff Portal", desc: "Manage onboarding, reviews and compliance." },
  { href: "/admin", label: "Admin Portal", desc: "Entities, services, templates and users." },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-medium text-accent">GNS Associates</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Onboarding &amp; Compliance Platform
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Foundation scaffold (Module&nbsp;M0). Authentication, the onboarding state machine and the
        portals below are implemented in subsequent modules.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {portals.map((p) => (
          <div key={p.href} className="rounded-lg border p-5">
            <h2 className="font-medium">{p.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            <Link href={p.href} className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                Open
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
