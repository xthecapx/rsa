import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "package.json"), "utf8"),
) as { version: string };

function resolvePwaBuildId(): string {
  if (process.env.NODE_ENV === "development") return "dev";
  if (process.env.PWA_BUILD_ID) return process.env.PWA_BUILD_ID;

  let git = "";
  try {
    git = execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // Docker build contexts often have no .git — clock stamp alone is enough.
  }

  // Always include a per-build stamp so uncommitted local rebuilds still bust
  // Cache Storage while the game is under active development.
  const stamp = Date.now().toString(36);
  return git ? `${pkg.version}+${git}.${stamp}` : `${pkg.version}+${stamp}`;
}

const pwaBuildId = resolvePwaBuildId();

const nextConfig: NextConfig = {
  output: "standalone",
  // frontend/ and game/ each have their own lockfile, so pin the root that
  // Next traces files from instead of letting it guess.
  outputFileTracingRoot: path.join(__dirname),

  env: {
    // Baked into the client bundle; also used as `/sw.js?v=...` so each
    // deploy installs a fresh worker and invalidates mitm-shell-* caches.
    NEXT_PUBLIC_PWA_BUILD_ID: pwaBuildId,
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  experimental: {
    // Next's rewrite proxy gives up after 30 s by default and surfaces a generic
    // failure. The slowest allowed simulation (Shor) may run up to the server's
    // 150 s limit and the client waits 165 s, so keep the proxy above both and
    // let the backend answer with its own translated 504.
    proxyTimeout: 170_000,
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:7001"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
