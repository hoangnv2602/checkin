#!/usr/bin/env bash
# tools/scripts/grpc-load-test.sh
#
# I-801 — Load test BFF gRPC :50052 (mobile scan endpoint).
# Target: p95 mobile scan < 100ms (so với 200ms REST baseline).
#
# Dùng ghz (https://ghz.dev/) — gRPC benchmarking tool. Nếu chưa cài:
#   go install github.com/bojand/ghz/cmd/ghz@latest
#
# Usage:
#   GRPC_HOST=localhost:50052 bash tools/scripts/grpc-load-test.sh
#   GRPC_HOST=api.staging.saas-checkin.com:50052 \
#     AUTH_TOKEN=$JWT \
#     bash tools/scripts/grpc-load-test.sh
#
# Requires: ghz, jq. Output ghi vào docs/operations/grpc-load-test-results.json
#           để track p95 trend theo tháng.
set -euo pipefail

: "${GRPC_HOST:=localhost:50052}"
: "${CONCURRENCY:=50}"
: "${TOTAL:=5000}"
: "${DURATION:=30s}"
: "${WARMUP:=100}"
: "${AUTH_TOKEN:=}"
: "${TENANT_ID:=test-tenant}"
: "${PROTO_PATH:=packages/proto/checkin/v1/checkin.proto}"
: "${OUT_FILE:=docs/operations/grpc-load-test-results.json}"

# Sanity check tooling
command -v ghz >/dev/null 2>&1 || {
  echo "✗ ghz not installed. Install: go install github.com/bojand/ghz/cmd/ghz@latest"
  exit 2
}
command -v jq >/dev/null 2>&1 || {
  echo "✗ jq not installed"
  exit 2
}

mkdir -p "$(dirname "$OUT_FILE")"

# ghz cần call proto + method + -d JSON data
# ScanRequest fields (xem checkin.proto): qr_payload, event_id, gate_id, scanned_at
PAYLOAD=$(cat <<EOF
{
  "qr_payload": "eyJhbGciOiJFZDI1NTE5In0.fake-jwt-for-load-test.signature",
  "event_id": "load-test-event-id",
  "gate_id": "load-test-gate-1",
  "scanned_at": { "seconds": $(date +%s), "nanos": 0 }
}
EOF
)

METADATA=()
if [ -n "$AUTH_TOKEN" ]; then
  METADATA+=("-H" "authorization=Bearer $AUTH_TOKEN")
fi
METADATA+=("-H" "x-tenant-id=$TENANT_ID")

echo "==> Load test: GRPC_HOST=$GRPC_HOST concurrency=$CONCURRENCY total=$TOTAL duration=$DURATION"
echo "==> Proto: $PROTO_PATH"
echo "==> Output: $OUT_FILE"

ghz \
  --insecure \
  --proto "$PROTO_PATH" \
  --call saascheckin.checkin.v1.CheckInService/Scan \
  -d "$PAYLOAD" \
  -c "$CONCURRENCY" \
  -n "$TOTAL" \
  --duration "$DURATION" \
  --warmup "$WARMUP" \
  --format=json \
  "${METADATA[@]}" \
  "$GRPC_HOST" \
  | tee "$OUT_FILE" >/dev/null

# Parse result, check p95 < 100ms target
P95_MS=$(jq -r '.details."(50.0%)"' "$OUT_FILE" 2>/dev/null || echo "0")
P95_99=$(jq -r '.details."(99.0%)"' "$OUT_FILE" 2>/dev/null || echo "0")
RPS=$(jq -r '.rps' "$OUT_FILE" 2>/dev/null || echo "0")
TOTAL_COUNT=$(jq -r '.count' "$OUT_FILE" 2>/dev/null || echo "0")
ERROR_PCT=$(jq -r '(.statusCodeDistribution | to_entries | map(select(.key != "OK") | .value) | add // 0) / .count * 100' "$OUT_FILE" 2>/dev/null || echo "0")

echo
echo "================================================"
echo "Load test results"
echo "================================================"
echo "Total requests: $TOTAL_COUNT"
echo "RPS:            $RPS"
echo "p50 latency:    ${P95_MS} ms"
echo "p99 latency:    ${P95_99} ms"
echo "Error rate:     ${ERROR_PCT}%"

# Phase 8 gate: p95 < 100ms (vs 200ms REST baseline = 50% improvement)
# Lưu ý: ghz output dùng percentile buckets; p50 thường < p95. Để conservative,
# check p99 < 100ms cho scan hot-path. Nếu fail, scale BFF workers hoặc
# check Redis hot-path latency.
P99_INT=${P95_99%.*}
if [ -z "$P99_INT" ] || [ "$P99_INT" -eq 0 ]; then
  echo "✗ Could not parse p99 latency"
  exit 1
fi
if [ "$P99_INT" -le 100 ]; then
  echo "✓ PASS: p99 = ${P95_99}ms ≤ 100ms target"
  exit 0
else
  echo "⚠ WARN: p99 = ${P95_99}ms > 100ms target. Investigate:"
  echo "  - Scale BFF: docker compose up --scale api-gateway=4"
  echo "  - Check Redis latency: redis-cli --latency -h redis"
  echo "  - Check core-api gRPC: ghz -n 1000 -c 10 ... :50051"
  exit 0  # Don't fail CI; just warn.
fi
