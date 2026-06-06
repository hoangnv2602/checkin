#!/usr/bin/env bash
# tools/chaos/scenarios/redis-down.sh — I-406 chaos: Redis down.
#
# Expect:
#  - Dashboard degrade graceful (read-only mode, last-known-stats)
#  - Check-in scan vẫn hoạt động (ghi DB, outbox queue event)
#  - WebSocket fanout degrade (no realtime updates nhưng data integrity OK)
#
# Pre-req: docker compose running
set -euo pipefail

echo "[chaos] redis-down scenario — starting"

# 1. Stop redis
docker compose -f infra/docker/docker-compose.dev.yml stop redis
echo "[chaos] redis stopped at $(date)"

# 2. Try a scan — should still work (writes DB)
SCAN_RESULT=$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST http://localhost:3001/v1/checkin/scan \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "00000000-0000-0000-0000-000000000001",
    "eventId": "00000000-0000-0000-0000-000000000010",
    "gateId": "00000000-0000-0000-0000-000000000020",
    "staffUserId": "00000000-0000-0000-0000-000000000030",
    "jti": "'$(uuidgen)'",
    "registrationId": "'$(uuidgen)'",
    "signature": "fake-signature-AAAA"
  }')
echo "[chaos] scan result (expect 200 or 422): HTTP $SCAN_RESULT"

if [[ "$SCAN_RESULT" != "200" && "$SCAN_RESULT" != "422" ]]; then
  echo "[chaos] FAIL: scan did not succeed when Redis down"
  docker compose -f infra/docker/docker-compose.dev.yml start redis
  exit 1
fi

# 3. Check dashboard stats endpoint — should fall back to DB
STATS_RESULT=$(curl -sS http://localhost:3001/v1/checkin/stats/00000000-0000-0000-0000-000000000010?organizationId=00000000-0000-0000-0000-000000000001)
echo "[chaos] stats response: $STATS_RESULT"

# 4. Restart redis
echo "[chaos] restarting redis"
docker compose -f infra/docker/docker-compose.dev.yml start redis
sleep 5

# 5. Verify scan still works after recovery
SCAN_RESULT2=$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST http://localhost:3001/v1/checkin/scan \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "00000000-0000-0000-0000-000000000001",
    "eventId": "00000000-0000-0000-0000-000000000010",
    "gateId": "00000000-0000-0000-0000-000000000020",
    "staffUserId": "00000000-0000-0000-0000-000000000030",
    "jti": "'$(uuidgen)'",
    "registrationId": "'$(uuidgen)'",
    "signature": "fake-signature-BBBB"
  }')
echo "[chaos] post-recovery scan result: HTTP $SCAN_RESULT2"

if [[ "$SCAN_RESULT2" != "200" && "$SCAN_RESULT2" != "422" ]]; then
  echo "[chaos] FAIL: scan failed after Redis recovery"
  exit 1
fi

echo "[chaos] redis-down scenario — PASS"
