import type { NextConfig } from "next";

const config: NextConfig = {
  // transpile shared workspace packages
  transpilePackages: ["@saas-checkin/contracts", "@saas-checkin/ui"],
  // standalone output cho Docker
  output: "standalone",
  typedRoutes: true,
  // Aurora design system: chỉ dùng semantic tokens, không hardcode colors
  // (enforce ở ESLint rule: no-restricted-syntax)
};

export default config;
