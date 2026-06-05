import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // Aurora tokens copy từ apps/web/src/app/globals.css (KHÔNG share file — D12, ADR-0014)
  experimental: { typedRoutes: true },
};

export default config;
