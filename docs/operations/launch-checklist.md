# Launch production checklist (I-706)

Pre-flight cho MVP ship. Đánh dấu mỗi mục, ký tên trước ngày launch.

## Env vars (per server)

- [ ] `/etc/<service>/.env` trên htz-app-1, htz-db-1
- [ ] JWT keys rotated trong 30 ngày qua
- [ ] Stripe + VNPay live keys (không phải test)
- [ ] Resend production API key
- [ ] S3/MinIO bucket policy review
- [ ] Database connection string với read replica (nếu có)

## DNS + SSL

- [ ] DNS record trỏ qua Cloudflare (proxied)
- [ ] SSL Full Strict (Cloudflare → origin)
- [ ] HSTS enabled (max-age 31536000, includeSubDomains, preload)
- [ ] TLS 1.2+ only (no TLS 1.0/1.1)
- [ ] Certificate auto-renew via Caddy

## Monitoring (Sentry + Uptime Kuma + Grafana)

- [ ] Sentry project cho web/api-gateway/core-api/mobile
- [ ] Sentry alerts wired tới #saas-checkin-ops
- [ ] Uptime Kuma probe mỗi 60s cho:
  - https://web.saas-checkin.com
  - https://admin.saas-checkin.com
  - https://api.saas-checkin.com/health/ready
- [ ] Grafana dashboard:
  - API latency p50/p95/p99
  - DB connection count
  - Redis hit rate
  - BullMQ queue depth
  - Memory RSS

## Alerts

- [ ] Channel: #saas-checkin-ops (Slack)
- [ ] Backup channel: Telegram / Discord
- [ ] Severity routing:
  - SEV-1 → IC + tech lead + CEO
  - SEV-2 → on-call + PM
  - SEV-3 → on-call
  - SEV-4 → ticket

## Backup verified

- [ ] pgbackrest backup gần nhất < 24h
- [ ] Restore drill pass trong 90 ngày qua (xem `db-restore-drills.log`)
- [ ] S3 bucket versioning enabled
- [ ] S3 cross-region replication sang backup region

## Smoke test on production

- [ ] Register flow end-to-end:
  1. Tạo org
  2. Tạo event
  3. Publish
  4. Visit /e/[slug]/event/[id]
  5. Submit register form
  6. Pay via Stripe live (test card 4242 4242 4242 4242)
  7. Verify QR email
  8. Scan QR trong mobile
  9. Verify dashboard updates realtime
- [ ] Billing flow: subscribe → upgrade → cancel
- [ ] Manual check-in
- [ ] Audit log hiển thị entries

## Status page

- [ ] Uptime Kuma public URL configured
- [ ] Custom domain `status.saas-checkin.com` (optional)
- [ ] Auto-update on probe fail
- [ ] Subscribe button cho incident notifications

## Support

- [ ] Email support@saas-checkin.com configured (forward to helpdesk)
- [ ] Helpdesk integration (Intercom / Crisp / Front)
- [ ] SLA: < 4h business hours, < 24h weekend
- [ ] Knowledge base: docs.saas-checkin.com (mkdocs)

## Security

- [ ] OWASP ASVS L2 sign-off (I-701)
- [ ] Trivy container scan clean
- [ ] Dep audit clean
- [ ] Pen-test report reviewed
- [ ] GDPR data handling reviewed (DPA template)

## Documentation

- [ ] Public docs published (mkdocs build → saas-checkin.com/docs)
- [ ] Status page linked
- [ ] Privacy policy + Terms of Service live
- [ ] Onboarding wizard tested
- [ ] Runbooks published (initial-deploy, add-vps, db-restore, rotate-jwt-keys, incident-response)

## Mobile

- [ ] App Store listing approved
- [ ] Play Store listing approved
- [ ] TestFlight + Internal testing signed off
- [ ] Push notification cert configured (APNs, FCM)
- [ ] Deep links configured (universal links, app links)

## Team

- [ ] On-call rotation live (PagerDuty / Opsgenie)
- [ ] IC playbook reviewed (`incident-response.md`)
- [ ] Comms templates ready (status page updates, customer emails)
- [ ] Post-mortem template ready

## Final go/no-go

| Item | Owner | Status | Date |
|------|-------|--------|------|
| All sections above checked | Tech lead | ☐ | ___ |
| Smoke test pass on prod | QA | ☐ | ___ |
| All parties signed off | CEO | ☐ | ___ |
| Launch announcement drafted | Marketing | ☐ | ___ |

**Definition of Done:** All checkboxes ticked, signatures collected, MVP SHIPPED 🎉
