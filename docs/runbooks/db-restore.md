# Runbook: DB restore (I-702)

Drill restore từ pgbackrest sang instance sạch. **Phase 7 (I-702) yêu cầu drill
mỗi quý**, đo RTO < 4h, log kết quả vào `docs/operations/db-restore-drills.log`.

Script tự động: `tools/scripts/db-restore-drill.sh` — chạy local (Docker) hoặc
remote (Hetzner htz-db-restore).

## Pre-flight

- [ ] pgbackrest stanza configured trên htz-db-1 (`stanza=saas-checkin-prod`)
- [ ] Backup gần nhất < 24h tuổi (check `ls -lt /opt/saas-checkin/backups/`)
- [ ] Instance sạch (DB mới) đã provision hoặc có quyền tạo ephemeral container
- [ ] Quyền truy cập `htz-db-restore` qua SSH key (prod chỉ IC + tech lead)
- [ ] Channel #saas-checkin-ops đã thông báo "DRILL STARTED"

## Quick start

### Local drill (không cần Hetzner)

```bash
# 5 phút. Spin up postgres 16 trong Docker, restore sample backup, verify.
bash tools/scripts/db-restore-drill.sh --local
```

Kết quả mẫu (đã chạy 2026-06-07):

```
[06:03:18] 1/6 Start fresh postgres container (port 55432)
[06:03:20]   postgres ready
[06:03:20] 2/6 Locate latest backup
[06:03:20] 3/6 Restore database
[06:03:20]   ✓ restore complete
[06:03:20] 4/6 Verify data integrity
[06:03:20]   public.organizations rows: 1
[06:03:20]   expected tables restored: 13 / 13
[06:03:20]   ✓ integrity check pass
[06:03:20] 5/6 Smoke test application connection
[06:03:22]   ✓ application connects
[06:03:22] 6/6 Cleanup + report
[06:03:22] Drill complete — RTO 0h0m4s
[06:03:22] ✓ RTO within 4h gate
```

### Staging drill (Hetzner)

```bash
RESTORE_HOST=htz-db-restore bash tools/scripts/db-restore-drill.sh
```

Script sẽ SSH vào htz-db-restore, dùng pgbackrest restore `--type=time
--target=<timestamp> --target-action=promote`, verify schema + RLS, smoke
test core-api connection, cleanup.

### Production drill (chỉ off-peak + IC approval)

```bash
# 1. Cần IC + tech lead approve trước (ghi vào #saas-checkin-ops)
# 2. Chọn restore point < 1h trước (không ảnh hưởng user data)
RESTORE_HOST=htz-db-restore-prod \
  BACKUP_LABEL="2026-06-07 02:00:00" \
  bash tools/scripts/db-restore-drill.sh
```

## Manual steps (nếu script fail hoặc cần debug)

```bash
# 1. SSH vào instance restore
ssh htz-db-restore

# 2. Stop application traffic
ssh htz-app-1 "docker compose stop web api-gateway"

# 3. Install pgbackrest nếu chưa có
apt-get install -y pgbackrest

# 4. Restore
sudo -u postgres pgbackrest restore \
  --stanza=saas-checkin-prod \
  --type=time \
  --target="2026-06-05 09:00:00" \
  --target-action=promote \
  --log-level-console=info

# 5. Start postgres, verify
sudo systemctl start postgresql
sudo -u postgres psql -c "SELECT COUNT(*) FROM public.organizations;"

# 6. Smoke test connection
docker compose exec core-api dotnet SaasCheckin.DbMigrator.dll --verify-rls

# 7. Promote to primary (nếu restore prod)
ssh htz-app-1 "docker compose start web api-gateway"
```

## Verify data integrity (production backup)

```sql
-- Schema check (drill pass = 13/13 tables present)
SELECT tablename FROM pg_tables
 WHERE schemaname='public'
   AND tablename IN ('organizations','users','plans','subscriptions',
                     'audit_log','check_in_records','orders','registrations',
                     'ticket_types','memberships','invoices',
                     'platform_users','platform_sessions');
-- expect 13 rows

-- RLS policies present (drill pass)
SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';
-- expect ≥ 11 (mỗi multi-tenant table có ≥1 policy)

-- Row count sanity
SELECT
  (SELECT COUNT(*) FROM public.organizations) AS orgs,
  (SELECT COUNT(*) FROM public.users) AS users,
  (SELECT COUNT(*) FROM public.audit_log) AS audit,
  (SELECT COUNT(*) FROM public.orders) AS orders,
  (SELECT COUNT(*) FROM public.registrations) AS registrations;

-- Recent activity
SELECT id, action, occurred_at FROM public.audit_log
 ORDER BY occurred_at DESC LIMIT 10;
```

## Measure RTO

```bash
# Script tự động — tổng thời gian in ra ở step 6
# Hoặc đo manual:
START=$(date +%s)
# ... steps 4-7
END=$(date +%s)
RTO=$(( END - START ))
echo "RTO: ${RTO}s"
```

| Tier | Target RTO | Penalty nếu vượt |
|---|---|---|
| 1 (no data loss) | < 30 phút | escalate IC |
| 2 (≤ 1h data loss) | < 4h | post-mortem + capacity review |
| 3 (> 1h data loss) | < 24h | executive review |

## Quarterly schedule

Cadence: tháng 1, 4, 7, 10 hàng năm (Q1/Q2/Q3/Q4).

Owner: on-call SRE (rotating). Approver: tech lead.

Mỗi quý:
1. Schedule window off-peak (2-4 AM UTC ngày Chủ Nhật)
2. Thông báo #saas-checkin-ops 24h trước
3. Chạy drill trên staging + production (production cần IC approval)
4. Append kết quả vào `docs/operations/db-restore-drills.log`
5. Nếu RTO > 4h, tạo ticket để investigate + add vào risk register

## Drill log format

`docs/operations/db-restore-drills.log` — append-only, mỗi dòng 1 drill:

```
2026-06-07T12:30:00Z OK   drill-20260607-123000 rto=0h0m4s
2026-06-07T13:02:42Z OK   drill-20260607-130240 rto=0h0m4s
2026-09-15T02:00:00Z FAIL drill-20260915-020000 exit=1 rto=2h18m30s
```

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `pgbackrest restore` timeout | Network or S3 issue | Retry, check `pgbackrest check-command` |
| RLS policies missing | Restore from pre-RLS backup | Re-run migrations after restore |
| App smoke test fail | Connection string stale | Update `apps/*/.env` + restart services |
| RTO > 4h | pgbackrest full restore slow | Switch to incremental restore, or increase `process_max` in `pgbackrest.conf` |

## Related

- `docs/runbooks/README.md` — on-call rotation
- `docs/runbooks/incident-response.md` — production incident procedure
- `docs/operations/launch-checklist.md` — backup verified gate
- `tools/scripts/db-restore-drill.sh` — automated drill script
