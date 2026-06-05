/**
 * apps/web/test/setup.ts
 *
 * Global test setup cho vitest. Import jest-dom matchers, set env defaults.
 */
import "@testing-library/jest-dom/vitest";

// Silence sonner / radix warnings during test runs
// Use bracket notation to avoid TS readonly error from @types/node
const env = process.env as Record<string, string | undefined>;
env["NODE_ENV"] = "test";
env["NEXT_PUBLIC_BFF_URL"] = env["NEXT_PUBLIC_BFF_URL"] ?? "http://localhost:3001";
