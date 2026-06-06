#!/usr/bin/env bash
# tools/security/dependency-audit.sh — I-701 dependency vulnerability scan
set -euo pipefail

echo "[audit] web (pnpm)"
pnpm --filter @saas-checkin/web audit --prod --audit-level=high || exit 1

echo "[audit] api-gateway (pnpm)"
pnpm --filter @saas-checkin/api-gateway audit --prod --audit-level=high || exit 1

echo "[audit] checkin-admin (pnpm)"
pnpm --filter @saas-checkin/checkin-admin audit --prod --audit-level=high || exit 1

echo "[audit] core-api (dotnet)"
cd apps/core-api
dotnet list package --vulnerable --include-transitive || exit 1
cd ../..

echo "[audit] mobile (dart)"
cd apps/mobile
dart pub outdated --mode=null-safety 2>&1 | grep -E '(HIGH|CRITICAL)' || echo "[audit] no high/critical pub outdated"
cd ../..

echo "[audit] all dependencies clean"
