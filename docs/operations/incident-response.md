# Incident response runbook (I-911)

> **Phase 9 — Platform Maturity.** SEV matrix, on-call, escalation, comms, post-mortem.
> Blameless culture. Drill quarterly với chaos test infra (Phase 4 I-405).

## Severity matrix

| SEV | Definition | Examples | Response time | Resolution target |
|-----|-----------|----------|---------------|-------------------|
| **SEV1** | Service down for > 25% of tenants | API 5xx > 5min, data loss, security breach | 5 min ack | 4 h |
| **SEV2** | Service degraded, workarounds exist | Slow API, partial outage, payment webhook lag | 15 min ack | 24 h |
| **SEV3** | Minor bug, no user impact | Typo, non-critical log noise, dev-only issue | next business day | 1 week |
| **SEV4** | Cosmetic / nice-to-have | Visual glitch, suggestion | backburner | when convenient |

## On-call schedule

Phase 9 dùng **Telegram + email** rotation (no PagerDuty cost). Phase 10+ upgrade Grafana OnCall.

```
Primary on-call:  tech lead (1 week rotation)
Secondary:        backup engineer
Escalation:       founder (if no ack trong 15 phút với SEV1)
```

Set Telegram bot `@SaasCheckinOncallBot` → forward alerts.

## Alert routing

| Source | Destination | Filter |
|--------|-------------|--------|
| Sentry (Phase 6) | Sentry dashboard + Slack ops channel | all unhandled exceptions |
| Uptime Kuma (Phase 6) | Telegram + email | HTTP 5xx > 2min, TLS cert expiring 14d |
| BullMQ DLQ (I-806) | Slack ops | depth > 10 hoặc fail rate > 5% |
| Hash chain break (I-908) | PagerDuty + Sentry | ANY break (Phase 10) |
| Slack/Discord (I-802) | Sentry → ops channel | severity=high |

## Communication

### Internal (within team)

1. **Acknowledge** trong chat: "On it — looking now"
2. **Declare SEV**: post in `#incidents` với format:
   ```
   🚨 SEV1: API 5xx spike
   Started: 14:32 UTC
   Impact: 25% of tenants getting 500 on POST /v1/events
   Status: investigating
   On-call: @alex
   ```
3. **Update mỗi 15 phút** cho SEV1, mỗi 1h cho SEV2
4. **Resolve** post: "✅ Resolved at 15:47 UTC — root cause: ... — fix: ..."

### External (customers)

- **SEV1**: status page update + email blast trong 30 phút
- **SEV2**: status page update trong 1 giờ
- **SEV3+**: changelog entry, no email
- Status page: Uptime Kuma public (Phase 6) → custom domain `status.saas-checkin.com`

### Templates

**Status page (SEV1):**
```
[Investigating] We're seeing elevated error rates on event creation
endpoints. Our team is investigating. Started at 14:32 UTC.
```

**Customer email (SEV1):**
```
Subject: Service incident — 14:32-15:47 UTC

Hi {{tenant.name}},

Between 14:32 and 15:47 UTC, you may have experienced errors when
creating events. Our team identified the root cause (Postgres
connection pool exhausted during a traffic spike) and deployed a fix.

No data was lost. Affected events have been retried automatically.

Post-mortem: {{link to doc}}

We apologize for the disruption.

— SaasCheckin team
```

## Escalation paths

```
SEV1 → 5 min no ack → secondary on-call
       15 min no ack → founder
       30 min no ack → public status + customer comms
SEV2 → 30 min no ack → secondary
       2h no ack → founder
SEV3+ → next business day
```

## Common runbooks

### API 5xx spike

1. Check Sentry → identify top error
2. Check Grafana → DB CPU, Redis CPU, API latency
3. If DB: check connection pool, long queries, RLS overhead
4. If Redis: check memory, eviction rate
5. If external: check Stripe / Resend / Twilio status page
6. Mitigate: scale up, drain traffic, rollback deploy
7. Post-mortem within 48h

### Database corruption / data loss

1. **STOP** writes: `ALTER ROLE app_runtime NOLOGIN`
2. Snapshot DB immediately: `pg_dump --schema-only` + WAL archive
3. Restore from backup (Phase 7 I-702) → choose RPO
4. Verify integrity via hash chain (I-908)
5. Notify customers if data loss
6. Post-mortem within 48h

### Security breach (token leak, RLS bypass)

1. **Rotate secrets immediately**: JWT_SIGNING_KEY, DB password, Stripe webhook secret
2. Identify scope: review audit log (Phase 6) + Sentry for suspicious activity
3. If RLS bypass: rotate `app_runtime` role, audit by ứng dụng
4. Customer notification within 24h (GDPR breach window)
5. File incident with authorities if PII affected
6. Post-mortem + CVE disclosure if applicable

### Hash chain break (I-908)

1. Identify break scope: how many rows, which tenant(s)
2. Reseed from backup if < 24h gap
3. If > 24h: investigate who had DB access, audit
4. Possibly compromise: rotate all credentials, force password reset
5. Customer notification (SOC 2 trust violation)

## Post-mortem template

```markdown
# Post-mortem: [SEV1/2] [short title]

**Date:** YYYY-MM-DD
**Author:** @name
**Status:** draft / final
**SEV:** 1 / 2
**Duration:** HH:MM
**Affected:** [tenants / endpoints / data]

## Summary
1-2 sentences. What broke, who was affected.

## Timeline (UTC)
- 14:32 — alert fired
- 14:35 — acknowledged by @alex
- 14:42 — root cause identified
- 15:10 — fix deployed
- 15:47 — fully resolved

## Root cause
Detailed explanation. Include 5-why if helpful.

## Impact
- Tenants affected: 12 of 47 (25%)
- Failed requests: ~3400
- Data loss: none
- Revenue impact: ~$X (estimate)

## What went well
- Alert fired within 2 min
- On-call ack trong 3 min
- Status page updated trong 25 min

## What went poorly
- Took 28 min to identify root cause (DB pool)
- Status page update chậm do manual process
- Customer email blast chưa automated

## Action items
- [ ] @alex: increase DB pool size (PR #N)
- [ ] @sam: automate status page from incident channel (Phase 10)
- [ ] @alex: add DB pool saturation alert (Grafana)
- [ ] @sam: write chaos test for connection pool exhaustion (Phase 10)
```

## Drills (quarterly)

- [ ] Q1: SEV2 simulation (chaos test, disable Redis)
- [ ] Q2: SEV1 simulation (kill API container, observe failover)
- [ ] Q3: Security incident simulation (rotate keys)
- [ ] Q4: DR drill (full restore from backup, RTO < 30 min)

Phase 4 chaos test infrastructure (I-405) + Phase 7 backup/restore drill (I-702)
are the building blocks.

## Out of scope (Phase 10+)

- PagerDuty / Opsgenie integration
- Automated status page from incident channel
- Customer email blast automation
- In-app incident banner
- Post-mortem template auto-generate from incident timeline
