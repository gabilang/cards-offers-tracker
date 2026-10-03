import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded at runtime by the admin "Scrape now" action; never bundle the browser automation library.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
