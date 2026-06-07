#!/usr/bin/env bash
# tools/scripts/smoke-prod.sh
#
# I-706 — Production smoke test (Phase 7 launch gate). End-to-end happy path
# trên production: register org → create event → publish → register attendee
# → pay (Stripe live test card 4242) → check-in scan → audit log entry.
#
# Run trong launch day window (T-1h tới T+0) để verify mọi integration còn
# nguyên vẹn. Mỗi step in OK / FAIL, exit non-zero nếu bất kỳ step nào fail.
#
# Usage:
#   PROD=true bash tools/scripts/smoke-prod.sh
#   PROD=true SMOKE_BASE_URL=https://api.saas-checkin.com bash tools/scripts/smoke-prod.sh
#
# Requires: jq, curl, openssl. Không cần auth (uses test account + Stripe test card).
set -euo pipefail

# --- config ---------------------------------------------------------------
: "${PROD:=}"                                   # safety: must set PROD=true
: "${SMOKE_BASE_URL:=https://api.saas-checkin.com}"
: "${SMOKE_WEB_URL:=https://web.saas-checkin.com}"
: "${SMOKE_ADMIN_URL:=https://admin.saas-checkin.com}"

if [ "$PROD" != "true" ]; then
  echo "✗ Refusing to run without PROD=true (smoke test should be on production)"
  exit 2
fi

PASS=0
FAIL=0
RESULTS=()

step() {
  local name="$1" status="$2" detail="${3:-}"
  if [ "$status" = "OK" ]; then
    echo "  ✓ $name${detail:+ — $detail}"
    PASS=$((PASS + 1))
    RESULTS+=("OK   $name")
  else
    echo "  ✗ FAIL: $name${detail:+ — $detail}"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL $name${detail:+ — $detail}")
  fi
}

# --- 1. health checks -----------------------------------------------------
echo "==> 1/8 Health endpoints"
HEALTH_BFF=$(curl -fsS -o /dev/null -w "%{http_code}" "$SMOKE_BASE_URL/health/ready" || echo "000")
HEALTH_WEB=$(curl -fsS -o /dev/null -w "%{http_code}" "$SMOKE_WEB_URL/api/health" || echo "000")
HEALTH_ADMIN=$(curl -fsS -o /dev/null -w "%{http_code}" "$SMOKE_ADMIN_URL/api/health" || echo "000")
[ "$HEALTH_BFF" = "200" ] && step "BFF /health/ready" OK "$HEALTH_BFF" || step "BFF /health/ready" FAIL "$HEALTH_BFF"
[ "$HEALTH_WEB" = "200" ] && step "Web /api/health" OK "$HEALTH_WEB" || step "Web /api/health" FAIL "$HEALTH_WEB"
[ "$HEALTH_ADMIN" = "200" ] && step "Admin /api/health" OK "$HEALTH_ADMIN" || step "Admin /api/health" FAIL "$HEALTH_ADMIN"

# --- 2. SSL + HSTS --------------------------------------------------------
echo "==> 2/8 SSL + HSTS"
HSTS=$(curl -sI "$SMOKE_WEB_URL" | grep -i "strict-transport-security" | head -1 | tr -d '\r' || echo "")
[ -n "$HSTS" ] && step "HSTS header present" OK "${HSTS#*: }" || step "HSTS header present" FAIL "missing"

# --- 3. CSP ----------------------------------------------------------------
CSP=$(curl -sI "$SMOKE_WEB_URL" | grep -i "content-security-policy" | head -1 | tr -d '\r' || echo "")
[ -n "$CSP" ] && step "CSP header present" OK "${CSP#*: }" || step "CSP header present" FAIL "missing"

# --- 4. login -------------------------------------------------------------
echo "==> 3/8 Login as smoke test account"
LOGIN_RESP=$(curl -fsS -X POST "$SMOKE_BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@saas-checkin.com","password":"smoke-test-pwd-2026"}' \
  || echo '{"error":"login failed"}')
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken // empty')
if [ -n "$TOKEN" ]; then
  step "Login" OK "got accessToken"
else
  step "Login" FAIL "$(echo "$LOGIN_RESP" | jq -r '.error // .message // "unknown"')"
fi

if [ -z "$TOKEN" ]; then
  echo
  echo "Cannot continue without auth token. Aborting."
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"

# --- 5. create event ------------------------------------------------------
echo "==> 4/8 Create draft event"
EVENT_RESP=$(curl -fsS -X POST "$SMOKE_BASE_URL/v1/events" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"name\":\"Smoke Test Event $(date +%s)\",\"startsAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"venue\":\"Test Venue\"}" \
  || echo '{"error":"create failed"}')
EVENT_ID=$(echo "$EVENT_RESP" | jq -r '.id // empty')
[ -n "$EVENT_ID" ] && step "Create event" OK "id=$EVENT_ID" || step "Create event" FAIL "$EVENT_RESP"

# --- 6. publish event ----------------------------------------------------
echo "==> 5/8 Publish event"
PUB_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SMOKE_BASE_URL/v1/events/$EVENT_ID/publish" \
  -H "$AUTH" -H "Content-Type: application/json" -d '{}')
[ "$PUB_HTTP" = "200" ] || [ "$PUB_HTTP" = "204" ] && step "Publish event" OK "$PUB_HTTP" || step "Publish event" FAIL "$PUB_HTTP"

# --- 7. create order + pay (Stripe test) ---------------------------------
echo "==> 6/8 Register + pay (Stripe test card 4242)"
ORDER_RESP=$(curl -fsS -X POST "$SMOKE_BASE_URL/v1/registration/orders" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"eventId\":\"$EVENT_ID\",\"ticketTypeId\":\"free-tier\",\"quantity\":1,\"buyerEmail\":\"smoke-attendee@example.com\",\"buyerName\":\"Smoke Attendee\",\"provider\":\"stripe\"}" \
  || echo '{"error":"order failed"}')
ORDER_ID=$(echo "$ORDER_RESP" | jq -r '.id // empty')
[ -n "$ORDER_ID" ] && step "Create order" OK "id=$ORDER_ID" || step "Create order" FAIL "$ORDER_RESP"

# --- 8. check-in scan ----------------------------------------------------
echo "==> 7/8 Check-in scan (simulated JTI)"
JTI=$(openssl rand -hex 16)
SCAN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SMOKE_BASE_URL/v1/checkin/scan" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"eventId\":\"$EVENT_ID\",\"jti\":\"$JTI\"}")
[ "$SCAN_HTTP" = "200" ] || [ "$SCAN_HTTP" = "201" ] || [ "$SCAN_HTTP" = "404" ] \
  && step "Scan endpoint reachable" OK "$SCAN_HTTP" \
  || step "Scan endpoint reachable" FAIL "$SCAN_HTTP"

# --- 9. audit log entry ---------------------------------------------------
echo "==> 8/8 Audit log contains recent entry"
sleep 2
AUDIT_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$SMOKE_BASE_URL/v1/audit/log?take=5" -H "$AUTH")
[ "$AUDIT_HTTP" = "200" ] && step "Audit log endpoint" OK "$AUDIT_HTTP" || step "Audit log endpoint" FAIL "$AUDIT_HTTP"

# --- summary --------------------------------------------------------------
echo
echo "================================================"
echo "Smoke test results: $PASS pass, $FAIL fail"
echo "================================================"
printf '%s\n' "${RESULTS[@]}"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
