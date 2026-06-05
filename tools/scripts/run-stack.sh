#!/usr/bin/env bash
# tools/scripts/run-stack.sh
#
# Phase C: Chạy 4 service + dev stack, verify health.
# Cần `bash tools/scripts/build-all.sh` chạy trước.
#
# Usage: bash tools/scripts/run-stack.sh [--stop]
#
# --stop: chỉ stop tất cả service (không start)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

PIDS=()
LOGS_DIR="$REPO_ROOT/.local/logs"
mkdir -p "$LOGS_DIR"

if [ "${1:-}" = "--stop" ]; then
  echo "── Stopping any running services ──"
  pkill -f "node.*next.*--port 3000" 2>/dev/null || true
  pkill -f "node.*next.*--port 3002" 2>/dev/null || true
  pkill -f "node.*dist/main" 2>/dev/null || true
  pkill -f "dotnet.*SaasCheckin.HttpApi.Host" 2>/dev/null || true
  sleep 1
  echo "  Done."
  exit 0
fi

cleanup() {
  echo
  echo "── Cleanup ──"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "  Stopped ${#PIDS[@]} services"
}
trap cleanup EXIT

echo "═══ Phase C — Run full stack + verify ═══"
echo

# 1. Start dev stack
echo "── 1. Dev stack (postgres, redis, mailhog, minio) ──"
if [ ! -f infra/docker/.env ]; then
  echo "  Copy .env.example → .env"
  cp infra/docker/.env.example infra/docker/.env
fi
docker compose -f infra/docker/docker-compose.dev.yml \
  --env-file infra/docker/.env up -d 2>&1 | tail -3
echo "  ✓ dev stack up"
echo

# Wait for postgres
echo "── 2. Wait for postgres healthy ──"
for i in {1..20}; do
  if docker exec saas-checkin-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "  ✓ postgres ready"
    break
  fi
  sleep 1
done
echo

# 3. Start apps (local — không qua Docker để verify build nhanh hơn)
echo "── 3. Start 4 services (local) ──"
echo "  → apps/core-api (.NET) on :5050"
ASPNETCORE_URLS=http://0.0.0.0:5050 \
  dotnet apps/core-api/src/SaasCheckin.HttpApi.Host/bin/Release/net10.0/SaasCheckin.HttpApi.Host.dll \
  > "$LOGS_DIR/core-api.log" 2>&1 &
PIDS+=($!)

echo "  → apps/api-gateway (NestJS) on :3001"
node apps/api-gateway/dist/main.js > "$LOGS_DIR/api-gateway.log" 2>&1 &
PIDS+=($!)

echo "  → apps/web (Next.js standalone) on :3000"
PORT=3000 HOSTNAME=0.0.0.0 \
  node apps/web/.next/standalone/apps/web/server.js > "$LOGS_DIR/web.log" 2>&1 &
PIDS+=($!)

echo "  → apps/checkin-admin (Next.js standalone) on :3002"
PORT=3002 HOSTNAME=0.0.0.0 \
  node apps/checkin-admin/.next/standalone/apps/checkin-admin/server.js > "$LOGS_DIR/checkin-admin.log" 2>&1 &
PIDS+=($!)
echo

# Wait for all to be ready
echo "── 4. Wait for services ready ──"
READY_URLS=(
  "http://localhost:5050/health/live"
  "http://localhost:3001/health/live"
  "http://localhost:3000/api/health"
  "http://localhost:3002/api/health"
)
for i in {1..25}; do
  ready=0
  for url in "${READY_URLS[@]}"; do
    code=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 1 "$url" 2>/dev/null || echo "000")
    [ "$code" = "200" ] && ready=$((ready+1))
  done
  if [ "$ready" -eq 4 ]; then
    echo "  ✓ all 4 services ready in ${i}s"
    break
  fi
  sleep 1
done
echo

# 5. Verify health
echo "── 5. Health checks ──"
HEALTH=0
# name|endpoint pairs — pipe separator avoids http:// :// collision
for pair in \
  "core-api|http://localhost:5050/health/live" \
  "api-gateway|http://localhost:3001/health/live" \
  "web|http://localhost:3000/api/health" \
  "checkin-admin|http://localhost:3002/api/health"; do
  name="${pair%%|*}"
  endpoint="${pair##*|}"
  http_code=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 2 "$endpoint" 2>/dev/null || echo "000")
  if [ "$http_code" = "200" ]; then
    echo "  ✓ $name → HTTP $http_code"
    HEALTH=$((HEALTH+1))
  else
    echo "  ✗ $name → HTTP $http_code (see .local/logs/$name.log)"
  fi
done
echo

# 6. Summary
echo "═══ Summary ═══"
echo "  Health endpoints passed: $HEALTH / 4"
echo "  Logs: $LOGS_DIR/"
echo
if [ "$HEALTH" -eq 4 ]; then
  echo "  ✓ Phase C verified — full stack running"
  echo
  echo "  Test in browser:"
  echo "    http://localhost:3000     — apps/web"
  echo "    http://localhost:3002     — apps/checkin-admin"
  echo "    http://localhost:5050/scalar/v1 — apps/core-api OpenAPI UI"
  echo "    http://localhost:3001/v1/docs  — apps/api-gateway Swagger"
  echo
  echo "  Press Ctrl+C to stop all services"
  # Wait forever
  wait
else
  echo "  ✗ Some services failed. Check logs at $LOGS_DIR/"
  exit 1
fi
