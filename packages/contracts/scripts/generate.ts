/**
 * packages/contracts/scripts/generate.ts
 *
 * Generate TS client (for web) + Dart client (for mobile) từ OpenAPI spec
 * mà NestJS API Gateway export.
 *
 * Pipeline:
 *   1. BFF (apps/api-gateway) export openapi.json → packages/contracts/openapi.json
 *   2. openapi-typescript → src/gen/web.ts (TS client cho apps/web)
 *   3. openapi-generator-cli → src/gen/mobile/ (Dart client cho apps/mobile)
 *
 * Phase 0: stub — BFF chưa có route thật để export. Phase 1+ sẽ wire.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const OPENAPI_FILE = resolve(__dirname, "../openapi.json");

if (!existsSync(OPENAPI_FILE)) {
  console.warn(`⚠ ${OPENAPI_FILE} not found.`);
  console.warn("  Run BFF first: pnpm --filter @saas-checkin/api-gateway start");
  console.warn("  Then export: curl http://localhost:3001/v1/docs-json > openapi.json");
  process.exit(0);
}

console.log("→ Generating TS client for web…");
execSync("pnpm gen:web", { stdio: "inherit" });

console.log("→ Generating Dart client for mobile…");
execSync("pnpm gen:mobile", { stdio: "inherit" });

console.log("✓ Done");
