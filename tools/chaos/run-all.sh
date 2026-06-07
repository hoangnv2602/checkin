#!/usr/bin/env bash
# tools/chaos/run-all.sh — I-406 chaos suite runner.
#
# Run all 4 chaos scenarios in sequence. Output summary ở cuối.
# Pre-req: docker compose up + api-gateway + core-api healthy on staging.
#
# Usage:
#   bash tools/chaos/run-all.sh
#   SCENARIOS="redis-down network-partition" bash tools/chaos/run-all.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS=${SCENARIOS:-"redis-down db-slow network-partition websocket-partition"}

LOG_DIR="${LOG_DIR:-tools/chaos/logs}"
mkdir -p "$LOG_DIR"

declare -A RESULTS
FAILED=0

for scenario in $SCENARIOS; do
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "[chaos] scenario: $scenario"
  echo "════════════════════════════════════════════════════════"

  LOG="$LOG_DIR/${scenario}-$(date +%Y%m%d-%H%M%S).log"
  START=$(date +%s)

  if bash "$SCRIPT_DIR/scenarios/${scenario}.sh" 2>&1 | tee "$LOG"; then
    RESULTS[$scenario]="PASS"
    ELAPSED=$(($(date +%s) - START))
    echo "[chaos] $scenario completed in ${ELAPSED}s"
  else
    RESULTS[$scenario]="FAIL"
    FAILED=$((FAILED + 1))
    echo "[chaos] $scenario FAILED — see $LOG"
  fi
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "[chaos] SUMMARY"
echo "════════════════════════════════════════════════════════"
for scenario in $SCENARIOS; do
  printf "%-30s %s\n" "$scenario" "${RESULTS[$scenario]:-SKIP}"
done

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "[chaos] $FAILED scenario(s) FAILED"
  exit 1
fi
echo "[chaos] ALL PASS"
