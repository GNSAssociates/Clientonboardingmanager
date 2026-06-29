/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Workspace packages are shipped as TypeScript source; Next compiles them.
  transpilePackages: ["@gns/config", "@gns/core", "@gns/db", "@gns/ai", "@gns/integrations"],
  experimental: {
    // pino and the postgres driver are server-only; keep them out of the bundle.
    serverComponentsExternalPackages: ["pino", "postgres"],
  },
};

export default nextConfig;
