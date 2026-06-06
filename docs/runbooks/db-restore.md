# Runbook: DB restore

Drill restore từ pgbackrest sang instance sạch. Phase 7 (I-702) yêu cầu drill
mỗi quý, đo RTO < 4h.

## Pre-flight

- [ ] pgbackrest stanza configured trên htz-db-1
- [ ] Backup gần nhất < 24h tuổi
- [ ] Instance sạch (DB mới) đã provision

## Steps

```bash
# 1. SSH vào instance restore
ssh htz-db-restore

# 2. Stop application traffic
#    (Nếu restore vào production, scale web/api-gateway xuống 0)
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
sudo -u postgres psql -c "SELECT COUNT(*) FROM tenants.organizations;"

# 6. Smoke test connection
docker compose exec core-api dotnet SaasCheckin.DbMigrator.dll --verify-rls

# 7. Promote to primary (nếu restore prod)
#    - Update connection string trong htz-app-1 .env
#    - Restart web/api-gateway
ssh htz-app-1 "docker compose start web api-gateway"
```

## Verify data integrity

```bash
# Sample queries
psql -c "SELECT COUNT(*) FROM core.events;"  # expect matches last backup
psql -c "SELECT id, email, created_at FROM core.users ORDER BY created_at DESC LIMIT 10;"
psql -c "SELECT COUNT(*) FROM audit.audit_log WHERE occurred_at > NOW() - INTERVAL '7 days';"
```

## Measure RTO

```bash
# Tính từ "stop traffic" tới "smoke test pass"
START=$(date +%s)
# ... steps 4-7
END=$(date +%s)
echo "RTO: $((END - START)) seconds"
```

## Escalation nếu RTO > 4h

- Bật maintenance mode: `https://web.saas-checkin.com/maintenance`
- Email tất cả tenants về downtime
- Nếu > 8h: declare incident, gọi data-recovery consultant
