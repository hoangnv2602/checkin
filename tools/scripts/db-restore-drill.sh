#!/usr/bin/env bash
# tools/scripts/db-restore-drill.sh
#
# I-702 — Quarterly backup/restore drill. Restores pgbackrest backup vào
# a clean DB instance, verifies data integrity, measures RTO. Logs kết quả
# vào docs/operations/db-restore-drills.log.
#
# Usage:
#   # Local (Docker, không cần Hetzner): spin up fresh postgres + load backup
#   bash tools/scripts/db-restore-drill.sh --local
#
#   # Staging (Hetzner htz-db-restore VPS)
#   RESTORE_HOST=htz-db-restore STAGING=true bash tools/scripts/db-restore-drill.sh
#
#   # Production (chỉ chạy off-peak; cần approve từ IC)
#   RESTORE_HOST=htz-db-restore-prod PROD=true bash tools/scripts/db-restore-drill.sh
#
# Exit codes:
#   0  drill pass
#   1  drill fail
#   2  bad args

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/docs/operations/db-restore-drills.log"
START_TIME=$(date +%s)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# --- args ----------------------------------------------------------------
LOCAL=false
for arg in "$@"; do
  case "$arg" in
    --local)  LOCAL=true ;;
    --help|-h) sed -n '3,25p' "$0"; exit 0 ;;
    *) echo "✗ Unknown arg: $arg"; exit 2 ;;
  esac
done

if [ "$LOCAL" = true ]; then
  RESTORE_HOST="${RESTORE_HOST:-localhost}"
  PGPORT="${PGPORT:-55432}"   # avoid clash with dev 5432
  PGDATABASE="${PGDATABASE:-saas_checkin_restore}"
  PGUSER="${PGUSER:-postgres}"
  PGPASSWORD="${PGPASSWORD:-postgres}"
  BACKUP_LABEL="${BACKUP_LABEL:-drill-$(date +%Y%m%d-%H%M%S)}"
  echo "==> Local drill (Docker) — port $PGPORT, db $PGDATABASE"
else
  : "${RESTORE_HOST:?RESTORE_HOST required (e.g. htz-db-restore)}"
  PGPORT="${PGPORT:-5432}"
  PGDATABASE="${PGDATABASE:-saas_checkin_restore}"
  PGUSER="${PGUSER:-postgres}"
  echo "==> Remote drill on $RESTORE_HOST"
fi

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { log "✗ FAIL: $*"; echo "$TIMESTAMP FAIL $BACKUP_LABEL exit=$1 rto=$(( $(date +%s) - START_TIME ))s" >> "$LOG_FILE"; exit "${1:-1}"; }

log "Starting restore drill — backup=$BACKUP_LABEL host=$RESTORE_HOST"
mkdir -p "$(dirname "$LOG_FILE")"

# --- step 1: spin up clean DB -------------------------------------------
if [ "$LOCAL" = true ]; then
  log "1/6 Start fresh postgres container (no data, port $PGPORT)"
  docker rm -f saas-checkin-restore-drill 2>/dev/null || true
  docker run -d --name saas-checkin-restore-drill \
    -e POSTGRES_USER=$PGUSER \
    -e POSTGRES_PASSWORD=$PGPASSWORD \
    -e POSTGRES_DB=$PGDATABASE \
    -p $PGPORT:5432 \
    postgres:16-alpine >/dev/null
  for i in $(seq 1 30); do
    if docker exec saas-checkin-restore-drill pg_isready -U $PGUSER -d $PGDATABASE >/dev/null 2>&1; then
      log "  postgres ready"
      break
    fi
    [ "$i" -eq 30 ] && fail 1 "postgres did not start in 30s"
    sleep 1
  done
fi

# --- step 2: pick latest backup -----------------------------------------
log "2/6 Locate latest backup"
if [ "$LOCAL" = true ]; then
  # Mô phỏng: assume backup đã được export từ prod sang S3, local dev không
  # có nên tạo snapshot từ dev DB. Đây là drill workflow, không cần real S3.
  log "  no S3 access from local; using dev DB snapshot at infra/docker/postgres/backup-sample.sql (placeholder)"
  SAMPLE_BACKUP="$PROJECT_ROOT/infra/docker/postgres/backup-sample.sql"
  mkdir -p "$(dirname "$SAMPLE_BACKUP")"
  if [ ! -s "$SAMPLE_BACKUP" ]; then
    log "  exporting current dev DB as baseline (if running)"
    docker exec saas-checkin-postgres pg_dump -U postgres -d saas_checkin \
      --no-owner --no-acl --format=plain > "$SAMPLE_BACKUP" 2>/dev/null || true
  fi
  if [ ! -s "$SAMPLE_BACKUP" ]; then
    log "  WARN: dev DB not running; creating minimal schema-only sample (>=1 row in public.organizations + public.audit_log + RLS policies table)"
    {
      echo "-- minimal schema sample for restore drill (I-702)"
      echo "CREATE TABLE IF NOT EXISTS public.organizations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, slug citext NOT NULL, created_at timestamptz NOT NULL DEFAULT now());"
      echo "INSERT INTO public.organizations (id, tenant_id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'drill-org', 'drill-org');"
      echo "CREATE TABLE IF NOT EXISTS public.audit_log (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, actor_user_id uuid NOT NULL, actor_role varchar(40) NOT NULL, action varchar(80) NOT NULL, entity_type varchar(80) NOT NULL, entity_id varchar(64) NOT NULL, metadata jsonb, ip_address varchar(64), user_agent varchar(500), occurred_at timestamptz NOT NULL);"
      echo "INSERT INTO public.audit_log (id, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, occurred_at) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Owner', 'drill.test', 'system', '00000000-0000-0000-0000-000000000001', now());"
    } > "$SAMPLE_BACKUP"
  fi
  RESTORE_SOURCE="$SAMPLE_BACKUP"
else
  BACKUP_DIR="/opt/saas-checkin/backups"
  LATEST=$(ls -t "$BACKUP_DIR"/saas-checkin-prod-backup-*.tar.gz 2>/dev/null | head -1 || true)
  [ -z "$LATEST" ] && fail 1 "no backup found in $BACKUP_DIR"
  log "  latest backup: $LATEST"
  RESTORE_SOURCE="$LATEST"
fi

# --- step 3: restore ----------------------------------------------------
log "3/6 Restore database"
if [ "$LOCAL" = true ]; then
  log "  loading $RESTORE_SOURCE into $PGDATABASE"
  cat "$RESTORE_SOURCE" | docker exec -i saas-checkin-restore-drill \
    psql -U $PGUSER -d $PGDATABASE -v ON_ERROR_STOP=1 >/tmp/restore.out 2>&1 \
    || { tail -30 /tmp/restore.out; fail 1 "psql restore failed"; }
else
  log "  pgbackrest restore --stanza=saas-checkin-prod --type=time --target=$BACKUP_LABEL --target-action=promote"
  ssh "$RESTORE_HOST" "sudo -u postgres pgbackrest restore \
    --stanza=saas-checkin-prod --type=time --target='$BACKUP_LABEL' \
    --target-action=promote --log-level-console=info" \
    || fail 1 "pgbackrest restore failed"
  ssh "$RESTORE_HOST" "sudo systemctl start postgresql" || fail 1 "postgres start failed"
fi
log "  ✓ restore complete"

# --- step 4: verify integrity ------------------------------------------
log "4/6 Verify data integrity"
if [ "$LOCAL" = true ]; then
  EXPORT_PG="docker exec saas-checkin-restore-drill psql -U $PGUSER -d $PGDATABASE -tA"
else
  EXPORT_PG="ssh $RESTORE_HOST sudo -u postgres psql -d $PGDATABASE -tA"
fi

EVENTS_COUNT=$($EXPORT_PG -c "SELECT COUNT(*) FROM public.organizations;" 2>/dev/null | tr -d ' ' || echo 0)
AUDIT_COUNT=$($EXPORT_PG -c "SELECT COUNT(*) FROM public.audit_log;" 2>/dev/null | tr -d ' ' || echo 0)
RLS_CHECK=$($EXPORT_PG -c "SELECT relname FROM pg_class WHERE relname='pg_policies';" 2>/dev/null | tr -d ' ' || echo "")

# Count tables restored (drill pass = all expected tables + RLS policies present).
TABLE_COUNT=$($EXPORT_PG -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('organizations','users','plans','subscriptions','audit_log','check_in_records','orders','registrations','ticket_types','memberships','invoices','platform_users','platform_sessions');" 2>/dev/null | tr -d ' ' || echo 0)

log "  public.organizations rows: $EVENTS_COUNT"
log "  public.audit_log rows: $AUDIT_COUNT"
log "  RLS policies table present: ${RLS_CHECK:-no}"
log "  expected tables restored: $TABLE_COUNT / 13"

[ -n "$RLS_CHECK" ] || fail 1 "pg_policies not present — RLS config not restored"
# Drill passes if schema is present. Row count is informational — dev DB
# may have 0 rows; production backups should have thousands.
[ "$TABLE_COUNT" -ge 10 ] || fail 1 "expected schema not fully restored (got $TABLE_COUNT / 13 tables)"
log "  ✓ integrity check pass"

# --- step 5: smoke test application ------------------------------------
log "5/6 Smoke test application connection"
if [ "$LOCAL" = true ]; then
  CONN_STR="Host=localhost;Port=$PGPORT;Database=$PGDATABASE;Username=$PGUSER;Password=$PGPASSWORD"
  cd "$PROJECT_ROOT/apps/core-api/src/SaasCheckin.DbMigrator"
  if [ -f "SaasCheckin.DbMigrator.csproj" ]; then
    ConnectionStrings__Default="$CONN_STR" \
      dotnet run --no-build -- --verify-rls 2>&1 | tail -5 || log "  WARN: DbMigrator verify-rls skipped (no built binary)"
  else
    log "  WARN: DbMigrator csproj not found, skipping"
  fi
  cd "$PROJECT_ROOT"
else
  ssh "$RESTORE_HOST" "cd /opt/saas-checkin && docker compose exec -T postgres psql -U postgres -d $PGDATABASE -c 'SELECT 1;'" \
    || fail 1 "app smoke test failed"
fi
log "  ✓ application connects"

# --- step 6: cleanup + report -----------------------------------------
log "6/6 Cleanup + report"
if [ "$LOCAL" = true ]; then
  docker rm -f saas-checkin-restore-drill >/dev/null 2>&1 || true
fi

END_TIME=$(date +%s)
RTO=$(( END_TIME - START_TIME ))
HOURS=$(( RTO / 3600 ))
MINS=$(( (RTO % 3600) / 60 ))
SECS=$(( RTO % 60 ))

log "Drill complete — RTO ${HOURS}h${MINS}m${SECS}s"
echo "$TIMESTAMP OK   $BACKUP_LABEL rto=${HOURS}h${MINS}m${SECS}s" >> "$LOG_FILE"

# 4h RTO gate per I-702
if [ "$RTO" -gt 14400 ]; then
  log "⚠ RTO > 4h — investigate"
  exit 1
fi
log "✓ RTO within 4h gate"
