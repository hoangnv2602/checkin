/**
 * apps/web/test/setup.ts
 *
 * Global test setup cho vitest. Import jest-dom matchers, set env defaults.
 */
import "@testing-library/jest-dom/vitest";

// Silence sonner / radix warnings during test runs
process.env.NODE_ENV = "test";
process.env.NEXT_PUBLIC_BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";
