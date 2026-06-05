/**
 * apps/web/src/modules/_shared/config/env.ts
 *
 * Server-only env access. `server-only` package (Next 14+) throws nếu bị
 * import từ client component — chặn nhầm lẫn leak secret ra bundle.
 */
import "server-only";

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  bffUrl: process.env.INTERNAL_API_URL ?? "http://localhost:3001",
} as const;
