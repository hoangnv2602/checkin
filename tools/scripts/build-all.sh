#!/usr/bin/env bash
# tools/scripts/build-all.sh
#
# Build tất cả 4 service + verify. Phase 0 verification.
#
# Prerequisites:
#   - pnpm 9+, node 22+
#   - .NET 10 SDK
#   - Docker + Compose
#   - infra/docker/.env tồn tại (copy từ .env.example)
#
# Usage: bash tools/scripts/build-all.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo "═══ Phase 0 — Build all services ═══"
echo

# 1. pnpm install (workspace)
echo "── 1. pnpm install ──"
pnpm install --prefer-offline 2>&1 | tail -5
ok "pnpm install"
echo

# 2. apps/web
echo "── 2. apps/web ──"
pnpm --filter @saas-checkin/web build 2>&1 | tail -3
ok "apps/web build"
echo

# 3. apps/checkin-admin
echo "── 3. apps/checkin-admin ──"
pnpm --filter @saas-checkin/checkin-admin build 2>&1 | tail -3
ok "apps/checkin-admin build"
echo

# 4. apps/api-gateway
echo "── 4. apps/api-gateway ──"
pnpm --filter @saas-checkin/api-gateway build 2>&1 | tail -3
ok "apps/api-gateway build"
echo

# 5. apps/core-api (.NET)
echo "── 5. apps/core-api (.NET 10) ──"
dotnet build apps/core-api/src/SaasCheckin.HttpApi.Host/SaasCheckin.HttpApi.Host.csproj \
  --configuration Release --no-incremental 2>&1 | tail -5
ok "core-api build"
echo

echo "═══ All 4 services built successfully ═══"
echo
echo "Next: bash tools/scripts/run-stack.sh    # chạy Phase C"
