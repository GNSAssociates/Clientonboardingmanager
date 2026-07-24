import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isCpanelBuild = process.env.CPANEL_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Workspace packages are shipped as TypeScript source; Next compiles them.
  transpilePackages: ["@gns/config", "@gns/core", "@gns/db", "@gns/ai", "@gns/integrations"],
  // The cPanel standalone host has no `sharp`, so Next's image optimizer errors
  // on every <Image>. Serve images unoptimized — they still display, and this
  // clears the flood of "sharp is required" errors and any related 500s.
  images: { unoptimized: true },
  // Self-contained server build (server.js + a pruned node_modules) for
  // non-Vercel Node.js hosts (e.g. cPanel). Only enabled for that build (via
  // CPANEL_BUILD=1) — Vercel has its own optimized output and this is left
  // off for it so the existing Vercel deploy is never affected.
  ...(isCpanelBuild ? { output: "standalone" } : {}),
  experimental: {
    // pino and the postgres driver are server-only; keep them out of the bundle.
    // @react-pdf/renderer must stay external so it can load its embedded font
    // metrics from node_modules at runtime (webpack bundling breaks this and
    // causes "Cannot read properties of undefined (reading 'unitsPerEm')").
    serverComponentsExternalPackages: ["pino", "postgres", "@react-pdf/renderer"],
    // Monorepo: trace from the workspace root so hoisted/workspace deps
    // (packages/db, packages/core, etc.) resolve and are included in the
    // standalone output. In Next 14 this lives under `experimental`.
    ...(isCpanelBuild ? { outputFileTracingRoot: path.join(__dirname, "../../") } : {}),
  },
};

export default nextConfig;
