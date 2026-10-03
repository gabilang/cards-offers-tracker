import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded at runtime by the admin "Scrape now" action; never bundle the browser automation library.
  serverExternalPackages: ["playwright", "playwright-core"],
  // On Vercel, scrapes run on GitHub Actions, so keep Chromium tooling out of the serverless functions.
  // (The in-process fallback is only for local development.)
  outputFileTracingExcludes: {
    "*": ["node_modules/playwright/**", "node_modules/playwright-core/**"],
  },
};

export default nextConfig;
