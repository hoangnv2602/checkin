# Runbook: Incident response

Khi có incident (outage, data breach, security finding). Theo NIST 800-61:
Detect → Contain → Eradicate → Recover → Post-mortem.

## 1. Detect

Sources:
- Sentry alert
- Uptime Kuma HTTP probe fail
- Customer report
- Grafana spike (p95 > 2x baseline)
- Log anomaly (error rate > 5%)

## 2. Triage (5 min)

- [ ] Confirm scope: which tenants, which services
- [ ] Check status page (auto-updated by Uptime Kuma)
- [ ] Notify #saas-checkin-ops Slack channel
- [ ] Assign Incident Commander (IC)

## 3. Contain (15 min)

```bash
# Disable affected feature
ssh htz-app-1
docker compose exec api-gateway \
  curl -X POST http://localhost:3001/v1/admin/feature/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"feature":"checkin"}'

# Or rollback to last known good
git checkout deploy/prod/last-good
docker compose pull
docker compose up -d

# Or scale down problematic instance
ssh htz-app-2 "docker compose stop core-api"
```

## 4. Communicate

- [ ] Post incident banner trên status page
- [ ] Email tenants affected (if data risk)
- [ ] Post incident update mỗi 30 min tới resolution

## 5. Eradicate

- [ ] Identify root cause (Sentry, Grafana, logs)
- [ ] Apply fix (patch, config, infra)
- [ ] Verify in staging first
- [ ] Deploy to production

## 6. Recover

- [ ] Verify affected services healthy
- [ ] Run smoke test on critical path
- [ ] Restore disabled features
- [ ] Post "all clear" on status page

## 7. Post-mortem (within 48h)

- [ ] Write blameless post-mortem (template in `docs/postmortems/`)
- [ ] Action items with owners + deadlines
- [ ] Update runbooks based on learnings
- [ ] Schedule review meeting

## Severity levels

| Sev | Definition | Response time | Notification |
|-----|------------|---------------|--------------|
| SEV-1 | Full outage / data loss | < 5 min | All hands, status page |
| SEV-2 | Major feature down, multiple tenants | < 15 min | On-call + PM |
| SEV-3 | Minor bug, workaround exists | < 4 hours | On-call |
| SEV-4 | Cosmetic, scheduled fix | Next sprint | Ticket only |
