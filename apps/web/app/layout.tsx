import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GNS Onboarding & Compliance Platform",
  description: "AI-powered client onboarding and compliance for GNS Associates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
