#!/usr/bin/env bash
# tools/chaos/scenarios/network-partition.sh — I-406 chaos: network partition
# giữa api-gateway và core-api.
#
# Phase 4 dev: dùng docker pause cho core-api container.
# Production: dùng toxiproxy hoặc AWS NACL.
#
# Expect:
#  - Mobile app queue scan offline (dùng pending_checkin drift table)
#  - Reconnect → drain queue
#  - WebSocket gateway re-emit từ cache khi partition phục hồi
set -euo pipefail

echo "[chaos] network-partition scenario — starting"

# Pause core-api
docker compose -f infra/docker/docker-compose.dev.yml pause core-api &
PAUSE_PID=$!

# Wait 30s
sleep 30

# Submit a scan during partition
SCAN_RESULT=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
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
echo "[chaos] scan during partition: HTTP $SCAN_RESULT (expect 502/503/504)"

# Unpause
docker compose -f infra/docker/docker-compose.dev.yml unpause core-api
sleep 5

# Reconnect → drain
SCAN_RESULT2=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 \
  -X POST http://localhost:3001/v1/checkin/scan \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "00000000-0000-0000-0000-000000000001",
    "eventId": "00000000-0000-0000-0000-000000000010",
    "gateId": "00000000-0000-0000-0000-000000000020",
    "staffUserId": "00000000-0000-0000-0000-000000000030",
    "jti": "'$(uuidgen)'",
    "registrationId": "'$(uuidgen)'",
    "signature": "fake-signature-post-recovery"
  }')
echo "[chaos] post-recovery scan: HTTP $SCAN_RESULT2"

wait $PAUSE_PID 2>/dev/null || true

if [[ "$SCAN_RESULT2" == "200" || "$SCAN_RESULT2" == "422" ]]; then
  echo "[chaos] network-partition scenario — PASS"
else
  echo "[chaos] network-partition scenario — FAIL: recovery scan returned $SCAN_RESULT2"
  exit 1
fi
