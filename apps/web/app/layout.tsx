import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GNS Compliance Manager",
  description: "AI-powered client onboarding, invoice summarization, and compliance for GNS Associates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
