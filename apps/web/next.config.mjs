import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Workspace packages are shipped as TypeScript source; Next compiles them.
  transpilePackages: ["@gns/config", "@gns/core", "@gns/db", "@gns/ai", "@gns/integrations"],
  experimental: {
    // pino and the postgres driver are server-only; keep them out of the bundle.
    // @react-pdf/renderer must stay external so it can load its embedded font
    // metrics from node_modules at runtime (webpack bundling breaks this and
    // causes "Cannot read properties of undefined (reading 'unitsPerEm')").
    serverComponentsExternalPackages: ["pino", "postgres", "@react-pdf/renderer"],
  },
  // Self-contained server build (server.js + a pruned node_modules) for
  // non-Vercel Node.js hosts (e.g. cPanel). Only enabled for that build (via
  // CPANEL_BUILD=1) — Vercel has its own optimized output and this is left
  // off for it so the existing Vercel deploy is never affected.
  ...(process.env.CPANEL_BUILD === "1"
    ? {
        output: "standalone",
        // Monorepo: trace from the workspace root so hoisted/workspace deps
        // (packages/db, packages/core, etc.) resolve and are included.
        outputFileTracingRoot: path.join(__dirname, "../../"),
      }
    : {}),
};

export default nextConfig;
