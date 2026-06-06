#!/usr/bin/env bash
# tools/security/trivy-scan.sh — I-701 Trivy container scan
set -euo pipefail

IMAGES=(
  "ghcr.io/saas-checkin/api-gateway:dev"
  "ghcr.io/saas-checkin/core-api:dev"
  "ghcr.io/saas-checkin/web:dev"
  "ghcr.io/saas-checkin/checkin-admin:dev"
)

for img in "${IMAGES[@]}"; do
  echo "[trivy] scanning $img"
  trivy image \
    --severity CRITICAL,HIGH \
    --exit-code 1 \
    --no-progress \
    "$img" || {
    echo "[trivy] FAILED: $img has critical/high CVE"
    exit 1
  }
done

echo "[trivy] all images passed (no CRITICAL/HIGH)"
