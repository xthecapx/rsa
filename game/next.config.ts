import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // frontend/ and game/ each have their own lockfile, so pin the root that
  // Next traces files from instead of letting it guess.
  outputFileTracingRoot: path.join(__dirname),

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
