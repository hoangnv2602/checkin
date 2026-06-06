#!/usr/bin/env bash
# tools/ops/db-restore-drill.sh — I-702 quarterly backup/restore drill
#
# Thực hiện full restore từ pgbackrest sang instance sạch, measure RTO,
# verify data integrity. Chạy mỗi quý + trước major release.
#
# Pre-req:
#   - pgbackrest stanza "saas-checkin-staging" configured
#   - htz-db-restore (clean instance) provisioned
#   - GH Actions secret HCLOUD_SSH_KEY
#
# Usage:
#   bash tools/ops/db-restore-drill.sh
set -euo pipefail

START_TS=$(date +%s)
START_HUMAN=$(date -Iseconds)
echo "[drill] start=$START_HUMAN"

DRILL_HOST=${DRILL_HOST:-htz-db-restore}
DRILL_SSH=${DRILL_SSH:-"root@$DRILL_HOST"}
RESTORE_TARGET=${RESTORE_TARGET:-"$(date -u -d '24 hours ago' '+%Y-%m-%d %H:%M:%S')"}

echo "[drill] target=$RESTORE_TARGET host=$DRILL_HOST"

# 1. Install pgbackrest
ssh "$DRILL_SSH" "apt-get install -y pgbackrest postgresql-client"

# 2. Configure pgbackrest
ssh "$DRILL_SSH" "cat > /etc/pgbackrest.conf <<EOF
[global]
repo1-type=s3
repo1-path=/saas-checkin-backups
repo1-s3-uri=...
[saas-checkin-staging]
pg1-path=/var/lib/postgresql/16/main
EOF"

# 3. Stop postgres + wipe data dir
ssh "$DRILL_SSH" "systemctl stop postgresql && rm -rf /var/lib/postgresql/16/main"

# 4. Restore
echo "[drill] restoring..."
ssh "$DRILL_SSH" "pgbackrest restore --stanza=saas-checkin-staging \
  --type=time \
  --target='$RESTORE_TARGET' \
  --target-action=promote \
  --log-level-console=info"

# 5. Start postgres
ssh "$DRILL_SSH" "systemctl start postgresql"
sleep 5

# 6. Verify data integrity
echo "[drill] verifying data integrity"
ROWS_USERS=$(ssh "$DRILL_SSH" "sudo -u postgres psql -t -A -c \"SELECT COUNT(*) FROM core.users\"")
ROWS_EVENTS=$(ssh "$DRILL_SSH" "sudo -u postgres psql -t -A -c \"SELECT COUNT(*) FROM core.events\"")
ROWS_REGISTRATIONS=$(ssh "$DRILL_SSH" "sudo -u postgres psql -t -A -c \"SELECT COUNT(*) FROM core.registrations\"")
ROWS_CHECKINS=$(ssh "$DRILL_SSH" "sudo -u postgres psql -t -A -c \"SELECT COUNT(*) FROM core.check_in_records\"")

echo "[drill] users=$ROWS_USERS events=$ROWS_EVENTS registrations=$ROWS_REGISTRATIONS checkins=$ROWS_CHECKINS"

if [[ -z "$ROWS_USERS" || "$ROWS_USERS" -lt 1 ]]; then
  echo "[drill] FAIL: users table empty after restore"
  exit 1
fi

# 7. Measure RTO
END_TS=$(date +%s)
RTO=$((END_TS - START_TS))
RTO_HUMAN="$((RTO / 60))m $((RTO % 60))s"
echo "[drill] end=$(date -Iseconds) RTO=$RTO_HUMAN ($RTO seconds)"

# 8. Append to drill log
DRILL_LOG=tools/ops/db-restore-drills.log
mkdir -p "$(dirname "$DRILL_LOG")"
cat >> "$DRILL_LOG" <<EOF
$START_HUMAN | RTO=$RTO_HUMAN | users=$ROWS_USERS events=$ROWS_EVENTS registrations=$ROWS_REGISTRATIONS checkins=$ROWS_CHECKINS
EOF

# 9. Pass criteria
if [[ $RTO -lt 14400 ]]; then
  echo "[drill] PASS (RTO < 4h)"
  exit 0
else
  echo "[drill] FAIL (RTO >= 4h)"
  exit 1
fi
