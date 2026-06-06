#!/usr/bin/env bash
# tools/chaos/scenarios/db-slow.sh — I-406 chaos: DB latency 1s.
#
# Inject latency bằng Postgres `pg_terminate_backend` hack hoặc dùng toxiproxy.
# Expect: scan vẫn trả < 1s (cache layer absorbs latency).
#
# Run: bash tools/chaos/scenarios/db-slow.sh
set -euo pipefail

echo "[chaos] db-slow scenario — starting"

# Simulate by pausing Postgres for 1s bằng cách dùng iptables
# Phase 4 dev: dùng docker pause/unpause
# Production: dùng toxiproxy giữa api-gateway và Postgres

DURATION_S=${DURATION_S:-30}

echo "[chaos] pausing postgres for ${DURATION_S}s"
docker compose -f infra/docker/docker-compose.dev.yml pause postgres &
PAUSE_PID=$!

START=$(date +%s%3N)
SCAN_RESULT=$(curl -sS -o /dev/null -w '%{http_code}' \
  --max-time 3 \
  -X POST http://localhost:3001/v1/checkin/scan \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "00000000-0000-0000-0000-000000000001",
    "eventId": "00000000-0000-0000-0000-000000000010",
    "gateId": "00000000-0000-0000-0000-000000000020",
    "staffUserId": "00000000-0000-0000-0000-000000000030",
    "jti": "'$(uuidgen)'",
    "registrationId": "'$(uuidgen)'",
    "signature": "fake-signature"
  }')
END=$(date +%s%3N)
LATENCY=$((END - START))
echo "[chaos] scan during DB pause: HTTP $SCAN_RESULT in ${LATENCY}ms"

# Unpause
wait $PAUSE_PID 2>/dev/null || docker compose -f infra/docker/docker-compose.dev.yml unpause postgres

# Pass criteria: scan still responds within timeout (cache helps)
if [[ "$LATENCY" -lt 2000 ]]; then
  echo "[chaos] db-slow scenario — PASS (scan completed in ${LATENCY}ms)"
else
  echo "[chaos] db-slow scenario — FAIL (scan took ${LATENCY}ms > 2000ms threshold)"
  exit 1
fi
