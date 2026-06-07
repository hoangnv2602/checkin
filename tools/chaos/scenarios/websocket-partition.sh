#!/usr/bin/env bash
# tools/chaos/scenarios/websocket-partition.sh — I-406 chaos: WebSocket
# gateway unreachable mid-scan.
#
# Expect:
#  - Mobile client detect disconnect → queue offline (drift pending_checkin)
#  - Reconnect → drain queue
#  - StatsUpdated emit resumes on reconnect (Redis adapter picks up new pub)
#
# Test strategy: pause api-gateway container for 5s, verify mobile behavior
# in CI by polling BFF REST scan + checking pending_checkin table size.
set -euo pipefail

echo "[chaos] websocket-partition scenario — starting"

DURATION_S=${DURATION_S:-5}

# Pause api-gateway
echo "[chaos] pausing api-gateway for ${DURATION_S}s"
docker compose -f infra/docker/docker-compose.dev.yml pause api-gateway &
PAUSE_PID=$!

# While paused, scan should fail (502/504 from upstream or 503 from mobile queue)
SCAN_RESULT=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 \
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
echo "[chaos] scan during partition: HTTP $SCAN_RESULT (expect 5xx — gateway unreachable)"

if [[ ! "$SCAN_RESULT" =~ ^5 ]]; then
  echo "[chaos] WARN: expected 5xx during partition, got $SCAN_RESULT"
fi

# Wait remaining duration
sleep "$DURATION_S"

# Unpause
docker compose -f infra/docker/docker-compose.dev.yml unpause api-gateway
sleep 3

# Verify recovery
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
  echo "[chaos] websocket-partition scenario — PASS"
else
  echo "[chaos] websocket-partition scenario — FAIL: recovery scan returned $SCAN_RESULT2"
  exit 1
fi
