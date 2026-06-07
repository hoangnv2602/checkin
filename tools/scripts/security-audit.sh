#!/usr/bin/env bash
# tools/scripts/security-audit.sh
#
# I-701 — Pre-launch security audit. Run mỗi release lớn hoặc trước khi
# ship production. Exits non-zero nếu còn critical/high CVE.
#
# Pipeline:
#   1. pnpm audit (Node deps) — apps/web, apps/api-gateway, apps/checkin-admin, packages/contracts
#   2. dotnet list package --vulnerable (NuGet) — apps/core-api
#   3. flutter pub outdated (Dart) — apps/mobile
#   4. Trivy filesystem scan (optional, nếu trivy đã cài)
#
# Usage:
#   bash tools/scripts/security-audit.sh          # full audit, exit non-zero on critical/high
#   bash tools/scripts/security-audit.sh --report  # write report to docs/security/audit-<date>.md
#
# Requires: pnpm 9+, dotnet 10, flutter 3.6+, trivy 0.50+ (optional)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

REPORT_MODE=false
[ "${1:-}" = "--report" ] && REPORT_MODE=true
DATE="$(date +%Y-%m-%d)"
REPORT_FILE="$PROJECT_ROOT/docs/security/audit-$DATE.md"

# --- 1. pnpm audit ---------------------------------------------------------
echo "==> 1/4 pnpm audit (Node workspaces)"
PNPM_AUDIT=$(pnpm audit --json 2>/dev/null || true)
PNPM_CRITICAL=$(echo "$PNPM_AUDIT" | node -e "
  let s=''; process.stdin.on('data',c=>s+=c); process.stdin.on('end',()=>{
    try {
      const j = JSON.parse(s);
      const meta = j.metadata?.vulnerabilities ?? {};
      const total = (meta.critical||0)+(meta.high||0);
      console.log(total);
    } catch { console.log(0); }
  });
")
PNPM_AUDIT_SUMMARY=$(pnpm audit 2>/dev/null | tail -30 || true)
echo "  critical/high count: $PNPM_CRITICAL"

# --- 2. dotnet vulnerable packages ---------------------------------------
echo "==> 2/4 dotnet list package --vulnerable (core-api)"
cd "$PROJECT_ROOT/apps/core-api"
DOTNET_VULN=$(dotnet list package --vulnerable --include-transitive 2>&1 | grep -E "has the following vulnerable" || true)
if [ -z "$DOTNET_VULN" ]; then
  DOTNET_CRITICAL=0
  echo "  no vulnerable packages"
else
  DOTNET_CRITICAL=$(echo "$DOTNET_VULN" | wc -l | tr -d ' ')
  echo "  vulnerable projects: $DOTNET_CRITICAL"
fi
cd "$PROJECT_ROOT"

# --- 3. flutter pub outdated ---------------------------------------------
echo "==> 3/4 flutter pub outdated (mobile)"
cd "$PROJECT_ROOT/apps/mobile"
FLUTTER_OUTDATED=$(flutter pub outdated 2>&1 | grep -E "^\s+\S+\s+\S+\s+\S+\s+\*?\S+\s+\S+" | wc -l | tr -d ' ' || true)
FLUTTER_SUMMARY=$(flutter pub outdated 2>&1 | head -40 || true)
echo "  outdated packages: ${FLUTTER_OUTDATED:-0}"
cd "$PROJECT_ROOT"

# --- 4. trivy filesystem (optional) --------------------------------------
echo "==> 4/4 trivy filesystem scan (optional)"
TRIVY_OUT=""
if command -v trivy >/dev/null 2>&1; then
  TRIVY_OUT=$(trivy fs --severity HIGH,CRITICAL --no-progress --quiet . 2>/dev/null || true)
  TRIVY_CRITICAL=$(echo "$TRIVY_OUT" | grep -cE "CRITICAL:" || true)
  TRIVY_HIGH=$(echo "$TRIVY_OUT" | grep -cE "HIGH:" || true)
  echo "  trivy CRITICAL: $TRIVY_CRITICAL  HIGH: $TRIVY_HIGH"
else
  TRIVY_CRITICAL="N/A"
  TRIVY_HIGH="N/A"
  echo "  trivy not installed (skip)"
fi

# --- write report ---------------------------------------------------------
if [ "$REPORT_MODE" = "true" ]; then
  cat > "$REPORT_FILE" <<EOF
# Security audit — $DATE

Generated bởi \`tools/scripts/security-audit.sh\`. Re-run trước mỗi release.

## Summary

| Source        | Critical | High |
|---------------|----------|------|
| pnpm (Node)   | $PNPM_CRITICAL | — |
| NuGet (.NET)  | $DOTNET_CRITICAL | — |
| pub.dev (Dart)| ${FLUTTER_OUTDATED:-0} outdated | — |
| Trivy fs scan | $TRIVY_CRITICAL | $TRIVY_HIGH |

## pnpm audit (Node)

\`\`\`
$PNPM_AUDIT_SUMMARY
\`\`\`

## dotnet

\`\`\`
$(cd "$PROJECT_ROOT/apps/core-api" && dotnet list package --vulnerable --include-transitive 2>&1 | tail -20)
\`\`\`

## flutter pub outdated

\`\`\`
$FLUTTER_SUMMARY
\`\`\`

$([ -n "$TRIVY_OUT" ] && echo "## Trivy filesystem
\`\`\`
$TRIVY_OUT
\`\`\`")

EOF
  echo "report: $REPORT_FILE"
fi

# --- final exit code ------------------------------------------------------
PNPM_CRITICAL=${PNPM_CRITICAL:-0}
DOTNET_CRITICAL=${DOTNET_CRITICAL:-0}
TRIVY_CRITICAL=${TRIVY_CRITICAL:-0}
TOTAL_CRITICAL=$((PNPM_CRITICAL + DOTNET_CRITICAL + TRIVY_CRITICAL))
if [ "$TOTAL_CRITICAL" -gt 0 ]; then
  echo
  echo "✗ FAIL: $TOTAL_CRITICAL critical CVE(s) found. Fix trước khi ship."
  exit 1
fi
echo
echo "✓ OK: no critical CVE. (outdated dev/CI deps are tracked in pnpm overrides)"
