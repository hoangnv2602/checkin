# Phase 8 — Scale (Tuần 17–18)

> **Mục tiêu:** Scale infrastructure cho 10k MAU, mở rộng payment surface, enterprise feature.
> **Phụ thuộc:** Phase 0-7 (production đã live).

## Backlog

### I-801 · [L] gRPC cho mobile client
- Hiện tại: Mobile → BFF (REST) → Core API (gRPC) = 2 hop, 1 lần parse JSON
- Mục tiêu: Mobile → BFF (gRPC) → Core API (gRPC) = 2 hop, 0 lần parse JSON
- Proto file share qua `packages/proto` (đã có sẵn ở Phase 0)
- BFF expose gRPC port (50051) song song với REST (3000)
- Mobile gen Dart code từ proto (đã có `protoc_plugin`)
- Tương thích ngược: REST endpoint vẫn chạy cho web (Next.js)
- Load test: p95 mobile scan < 100ms (so với 200ms hiện tại qua REST)

### I-802 · [M] Slack + Discord notifier
- `apps/api-gateway/src/modules/notification/adapters/slack.adapter.ts`
- `apps/api-gateway/src/modules/notification/adapters/discord.adapter.ts`
- Tuân theo `INotifier` interface (giống Resend)
- Dùng cho:
  - Alert Sentry severity cao → channel ops
  - Event published → channel team
  - Plan limit hit → DM organizer
- Per-tenant config: tenant tự chọn channel + webhook URL (lưu encrypted)
- Retry với exponential backoff (5 lần), rate-limited theo Slack/Discord tier

### I-803 · [L] Stripe Connect — payout cho organizer
- Multi-organizer marketplace model: platform giữ % commission
- Onboard organizer qua Stripe Connect Express
- Khi event paid: chia tiền tự động (application_fee_amount = commission)
- Payout schedule: T+2 (default) hoặc manual
- Refund flow: refund full hoặc partial, trừ fee nếu organizer đã nhận
- Webhook `account.updated`, `payout.paid`, `charge.refunded` xử lý
- Plan mới `Marketplace` (10% commission) + `Pro` (5%) + `Enterprise` (custom)

### I-804 · [L] White-label custom domain
- Enterprise tenant có `customDomain` field (e.g. `events.acme-corp.com`)
- Caddy on-demand TLS via Cloudflare DNS-01 challenge
- DNS config: tenant trỏ CNAME → `cname.saas-checkin.com`
- Tenant lookup: middleware resolve domain → tenantId từ Redis cache (5 phút TTL)
- Auto-issue cert khi request đầu tiên, cache forever (Caddy tự renew)
- Wildcard cert `*.saas-checkin.com` cho shared domain
- Plan gate: chỉ `Enterprise` plan mới bật

### I-805 · [M] Read replica routing
- Core API EF Core: split thành `WriteDbContext` (primary) + `ReadDbContext` (replica)
- Repository interface có marker `IReadRepository` → route qua replica
- Default: write path, command handlers, RLS-bound queries → primary
- Read path: stats, analytics, dashboard queries, public event page → replica
- Failover: replica down → fallback primary (log warning)
- Health check endpoint expose replica lag

### I-806 · [M] BullMQ DLX + retry policy
- Tất cả queue thêm `defaultJobOptions`: 3 retries, exponential backoff (1s, 5s, 30s)
- Failed job sau 3 retries → DLQ (dead-letter queue)
- DLQ retention 7 ngày, manual replay UI trong `checkin-admin`
- Worker monitoring: stuck job detector (processing > 5 phút → mark failed)
- Metric: queue depth, retry count, DLQ size → Grafana

### I-807 · [M] Per-tenant rate limit tiers
- Rate limit dựa trên plan:
  - `Free`: 60 req/min
  - `Pro`: 300 req/min
  - `Enterprise`: 1000 req/min
- Implement qua `@nestjs/throttler` + custom guard đọc plan từ JWT
- Per-IP fallback cho unauth endpoint (login, public event)
- Burst allowance: 2x trong 10 giây đầu
- 429 response với `Retry-After` header
- Metric export Prometheus

---

## Definition of Done

- [ ] Mobile gRPC scan p95 < 100ms, parity feature với REST
- [ ] Slack/Discord notifier chạy được, có retry + rate-limit
- [ ] Stripe Connect onboard → charge → payout → refund end-to-end
- [ ] White-label domain auto-TLS qua Caddy + Cloudflare
- [ ] Read replica routing với failover verified
- [ ] BullMQ DLX có UI replay trong checkin-admin
- [ ] Per-tenant rate limit active, 429 có Retry-After
- [ ] **READY for 10k MAU 🚀**
