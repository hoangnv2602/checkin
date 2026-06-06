# Performance tuning checklist (I-704)

Profile 1000 MAU trong staging, identify bottlenecks, optimize, measure impact.

## Profile queries (pg_stat_statements)

```sql
-- Top 20 slow queries
SELECT
  substring(query, 1, 200) AS query_sample,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct_total
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Targets:
- p95 dashboard `/[orgSlug]/events/[eventId]/checkin` < 200ms
- p95 scan `/v1/checkin/scan` < 200ms
- p95 public event `/e/[orgSlug]/event/[eventId]` < 300ms
- p95 billing `/[orgSlug]/billing` < 500ms

## Index strategy

Verify indexes (Phase 3-5 migrations):
- `ticket_types (tenant_id, event_id)` ✓
- `orders (tenant_id, event_id, status)` ✓
- `orders (provider_session_id)` ✓
- `orders (status, expires_at)` ✓
- `registrations (tenant_id, jti)` UNIQUE ✓
- `registrations (tenant_id, event_id, status)` ✓
- `registrations (tenant_id, attendee_email)` ✓
- `check_in_records (tenant_id, event_id, scanned_at)` ✓
- `check_in_records (tenant_id, registration_id, status)` UNIQUE WHERE status=0 ✓
- `memberships (tenant_id, user_id)` UNIQUE ✓
- `memberships (tenant_id)` + `memberships (user_id)` ✓
- `audit_log (tenant_id, occurred_at)` ✓
- `subscriptions (organization_id)` UNIQUE ✓

Missing indexes thường gặp:
- `(tenant_id, created_at)` cho audit log filter
- `(tenant_id, email)` nếu search attendees theo email

## Cache hit rate

```bash
# Redis
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses
# Hit rate = hits / (hits + misses). Target > 80% trên hot path.
```

Hot paths:
- `event:{orgId}:{eventId}` 5 phút TTL
- `checkin:event:{eventId}:count` 24h TTL
- `checkin:reg:{regId}:status` 2d TTL
- `plan-limit:{orgId}:{kind}` 5 phút TTL
- `qr:signing-key:{tenantId}` 24h TTL

Nếu hit rate thấp, tăng TTL hoặc warm-up cache ở startup.

## Connection pool

```bash
# EF Core
"Default": "Host=...;Maximum Pool Size=100;Minimum Pool Size=10"
# Postgres max_connections
SHOW max_connections;  -- default 100, scale lên 200 cho multi-app
```

## API gateway

- BullMQ concurrency per worker: 5
- Pino logger JSON format (avoid pretty in prod)
- gRPC channel pool: 4 channels

## Web

- Server components mặc định, chỉ client khi cần interactive
- React Query staleTime 30s cho list, 5 phút cho stats
- Image optimization qua `next/image`
- Static assets CDN (Cloudflare)

## Mobile

- Drift pagination 20/page
- Drift index: `(scanned_at DESC)`, `(event_id, status)`
- Drift: avoid re-aggregating full tables; use computed columns

## Stress test

```bash
# 1000 MAU
k6 run --vus 100 --duration 30m tools/loadtest/checkin.js

# Spike
k6 run --stage 30s:100,30s:1000,30s:100 tools/loadtest/checkin.js
```

Sentry / Grafana: track
- p50 / p95 / p99 per endpoint
- DB connection count
- Cache hit rate
- BullMQ queue depth
- Memory RSS (leak detector)

## Optimization tactics

1. **Read-model projection** — pre-aggregate thay vì query live. I-601 đã có EventStatsReadModel.
2. **Materialized view** — cho cohort by ticket type ở 10k+ registrations
3. **Cursor pagination** thay offset (deep pagination chậm vì OFFSET scan)
4. **Compression** — gzip response ở BFF middleware
5. **HTTP/2** — Hetzner Caddy mặc định
6. **Redis pipeline** — batch nhiều GET trong 1 round-trip
7. **Async writes** — QR render, email gửi qua BullMQ (không block scan)

## Pass criteria

- [ ] p95 dashboard < 200ms (mục tiêu ban đầu)
- [ ] p95 scan < 200ms (verified qua k6 I-405)
- [ ] p95 public event < 300ms
- [ ] Redis hit rate > 80% trên hot path
- [ ] DB connection utilization < 70% peak
- [ ] No memory leak ở api-gateway (RSS stable 30 phút)
- [ ] 0 N+1 queries (verify qua EF Core logging)
