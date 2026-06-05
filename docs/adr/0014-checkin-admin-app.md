# 0014. Check-in Admin App — `apps/checkin-admin` tách Next.js riêng

- **Status:** Accepted (D12)
- **Date:** 2026-06-04
- **Deciders:** @team/tech-leads
- **Related:** [D12 in decisions.md](../decisions.md), [`docs/checkin-admin.md`](../checkin-admin.md), [0013-dotnet-core-10-ddd.md](./0013-dotnet-core-10-ddd.md)

## Context

Sau khi migrate sang .NET Core 10 (ADR-0013) và lock tech stack, vẫn còn 1 câu hỏi kiến trúc lớn: **quản trị SaaS (platform owner / support / engineer) chạy ở đâu?**

Docs hiện tại (`00-overview.md`, `01-architecture.md`, `03-monorepo.md`) chỉ mô tả **tenant admin** (organizer dashboard ở `(dashboard)/[orgSlug]/` trong `apps/web`). "User persona" gồm 4 role (Owner / Organizer / Staff / Gate) — **tất cả đều trong phạm vi 1 tenant**. Không có persona / route / API nào cho người vận hành SaaS (cross-tenant).

Tuy nhiên, một số chỗ docs **ngầm thừa nhận** cần cross-tenant access:

- `11-risks.md:17` nhắc `BYPASSRLS` — chỉ platform owner mới cần bypass RLS để support khách.
- `11-risks.md:13` (cũ) nhắc "dev quên set `app.current_tenant`" → ai đó phải truy cập cross-tenant để phát hiện & fix.
- `01-architecture.md:60` nói `ICurrentTenant` ambient scope từ JWT claim → nếu không có tenant (cross-tenant actor), middleware phải xử lý riêng.
- Phase 5 billing cần actor cross-tenant để refund khi tenant kẹt payment.
- Phase 7 hardening cần security review, audit log viewer cross-tenant.

Hiện tại không có UI / API / persona nào cho actor này. Nếu không quyết sớm, team sẽ tự phát triển theo 3 hướng drift:
1. Add 1 route group `(checkin-admin)` trong `apps/web` — đơn giản nhưng lẫn code, JWT signing key trùng, XSS ở tenant có thể escalate.
2. Viết CLI / Retool / Metabase ngoài — workaround tạm, không self-service, support chậm.
3. Tạo 1 SaaS NestJS BFF riêng `apps/checkin-admin-api` + web tĩnh đơn giản — quá nhiều moving parts cho MVP.

Cần 1 quyết định rõ ràng **trước Phase 0 DoD** để:
- Cấu hình monorepo đúng (1 vs 2 Next.js app)
- Setup Postgres role ngay từ migration đầu (1 vs 2 role)
- Setup JWT signing key audience (`aud: 'web'` vs `aud: 'checkin-admin'`)
- Setup Caddy / Cloudflare subdomain

## Decision

Tạo `apps/checkin-admin` là **Next.js 16.2.x project tách biệt** (cùng version, cùng pattern, nhưng project riêng, deploy riêng, domain riêng). Theo các nguyên tắc sau:

### 1. Hai app, hai audience, hai security boundary

| | `apps/web` (tenant) | `apps/checkin-admin` (platform) |
|---|---|---|
| Audience | Organizer / Staff / Gate của 1 org | Platform Owner / Support / Engineer của SaaS |
| Subdomain | `web.saas-checkin.com` | `admin.saas-checkin.com` |
| JWT `aud` | `web` | `checkin-admin` |
| JWT có `orgId`? | Có | **Không** |
| MFA | Optional (Phase 8+) | **Bắt buộc TOTP** từ lần login đầu |
| Refresh TTL | 30 ngày | 8 giờ |
| IP allowlist | Không | Có (Cloudflare WAF + `IpAllowlistGuard` BFF) |
| Cookie | `sa_session` (`.saas-checkin.com`) | `sa_pa_session` (`.admin.saas-checkin.com`) |
| Postgres role | `app_runtime` (RLS enforced) | `app_platform_owner` (BYPASSRLS) |

### 2. Context mới `PlatformOperations` trong `SaasCheckin.Domain/`

Thay vì mở rộng `Identity` (sẽ phình to + lẫn concern), tạo bounded context riêng:

- `PlatformUser` (AggregateRoot<Guid>) — không có `tenant_id`, lưu `role` ∈ {`platform_owner`, `platform_support`, `platform_engineer`}, `mfa_secret`, `mfa_enabled`, lockout policy
- `PlatformSession` (AggregateRoot<Guid>) — session token + refresh, IP binding, 30 phút TTL access
- `PlatformAuditEntry` (AggregateRoot<Guid>) — append-only, mỗi mutation từ checkin-admin (Phase 6)

Pattern giao tiếp với context khác: qua `IIntegrationEventBus` hoặc ID + repository read-only. **Không** sờ trực tiếp aggregate của context khác (vd `PlatformOperations` không gọi `Billing.Subscription.Cancel()` trực tiếp — phải publish `CancelSubscriptionCommand` qua integration bus để Billing aggregate handle + emit event, PlatformOperations chỉ log).

### 3. Hai gRPC channel, hai service-account

`SaasCheckin.HttpApi.Host` chạy 2 `DbContextFactory` trong DI:

| Factory | Role Postgres | Tenant interceptor | Audit log | Metadata inbound |
|---|---|---|---|---|
| `RuntimeDbContextFactory` | `app_runtime` | Bật (set `app.current_tenant`) | (tenant audit_log riêng) | (mặc định) |
| `PlatformDbContextFactory` | `app_platform_owner` | Tắt | Trigger Postgres insert `platform_audit_log` row mỗi save | `x-platform-role: true` |

`apps/api-gateway/src/infra/grpc/tenant-client.ts` — service-account `aud: 'core-api'`, scope `app_runtime`.
`apps/api-gateway/src/modules/checkin-admin/platform-grpc.client.ts` — service-account `aud: 'core-api-platform'`, scope `app_platform_owner`.

### 4. Hai BFF module, cùng NestJS process

`apps/api-gateway` cùng process, port 3000, nhưng 2 module:

- `modules/tenant/*` — `JwtAuthGuard` check `aud: 'web'`, có `orgId` claim, RLS enforced
- `modules/checkin-admin/*` — `PlatformAdminAuthGuard` check `aud: 'checkin-admin'`, có `mfa: true`, KHÔNG có `orgId`, IP allowlist, service-account BYPASSRLS

Path prefix phân biệt: `/v1/*` cho tenant, `/v1/admin/*` cho platform.

### 5. Audit log bất di bất dịch

- Bảng `platform_audit_log` (RLS đặc biệt): `app_runtime` SELECT được của tenant mình, `app_platform_owner` SELECT tất cả, **không role nào có UPDATE/DELETE**
- Trigger Postgres ở table `platform_*` để auto-insert log row khi mutation
- Middleware .NET tự động ghi log cho mọi HTTP POST/PATCH/DELETE
- File này là **append-only** forever; backup stream riêng (PITR archive)

### 6. Aurora tokens + shadcn CLI — duplicate có kiểm soát

- Aurora tokens (CSS variables) copy từ `apps/web/src/app/globals.css` sang `apps/checkin-admin/src/app/globals.css` (KHÔNG share file)
- shadcn component init riêng trong `apps/checkin-admin/` (`components.json` riêng)
- Component UI (Button, Card, Dialog, Table, …) duplicate từ `apps/web/src/components/ui/`
- Lý do: 2 audience, 2 security boundary, 2 release cadence. Share qua path alias / `packages/ui/` ở Phase 6+ nếu duplication thành gánh nặng (revisit risk #22)
- Trong CI: có script `scripts/sync-aurora-tokens.sh` (chạy manual) để copy token update; PR review bắt buộc

## Consequences

### Positive

- **Security boundary rõ ràng.** Nếu `apps/web` bị XSS / supply-chain attack, attacker không tự động có quyền checkin-admin. JWT signing key audience khác nhau, cookie domain khác nhau, deploy độc lập.
- **MFA + IP allowlist bắt buộc** ở checkin-admin từ đầu, không phải afterthought. Refresh token TTL ngắn (8h) giảm blast radius nếu lộ.
- **Audit log bắt buộc** mọi mutation cross-tenant. Compliance / forensic dễ.
- **BYPASSRLS chỉ active trong scope gRPC platform** — không lẫn vào code path tenant. NetArchTest enforce: PlatformOperations.Domain không reference Identity.Domain.
- **Release độc lập.** Update UI tenant không sợ break checkin-admin (và ngược lại). Platform team ship audit log viewer gấp không cần chờ release tenant.
- **Scale độc lập.** Super-admin traffic thấp (vài user), 1 replica là đủ; tenant traffic scale 2+ replicas riêng.
- **3 domain tách biệt** (`web.*`, `admin.*`, `api.*`) — Cloudflare WAF rule riêng cho từng cái. `admin.*` chỉ IP team + VPN support.

### Negative

- **Code duplication 2 Next.js app.** Aurora tokens + shadcn components (~30 file UI) duplicate. ~2-3 ngày effort sync lần đầu. Trade-off acceptable vì 2 audience thực sự khác nhau.
- **2 Postgres role, 2 gRPC channel, 2 BFF module.** Nhiều infrastructure hơn ~1.5x so với merge. Nhưng cần thiết cho security boundary.
- **Cognitive load cho dev.** Phải nhớ: route này thuộc tenant hay platform? Guard nào? Cookie nào? Giảm bằng CODEOWNERS tách + ESLint rule cấm import cross-app + convention folder `apps/<area>/src/`.
- **Platform audit log dùng `outbox_messages` tạm** ở Phase 1-5 (chưa có `PlatformAuditEntry`). Tạm đủ cho MVP nhưng cần upgrade Phase 6.

### Neutral

- **Migration 1 phase nhiều task** — Phase 0 phải thêm I-013b (checkin-admin skeleton), Phase 1 phải thêm I-106 / I-107 / I-108 (PlatformOperations context + BFF + Next.js). Nhưng mỗi task đều S/M size, không phải blocker.
- **MFA setup ở lần login đầu** phải có UX tốt — Phase 1 issue riêng cho flow.
- **IP allowlist** cần team VPN + cập nhật khi có người mới → ops overhead nhỏ.

## Alternatives considered

- **Chung `apps/web`, route group `(checkin-admin)`** — từ chối:
  - Security boundary mỏng: 1 bug ở tenant có thể leak JWT checkin-admin (cùng cookie domain nếu cùng `saas-checkin.com`, hoặc attacker control subdomain).
  - Khó enforce tách biệt: dev quên `requireRole('platform_owner')` ở 1 route = breach.
  - Tái cấu trúc lại sau rất tốn.
  - Chỉ phù hợp nếu platform team < 2 người và traffic checkin-admin cực thấp (không phải case này).

- **App Next.js riêng nhưng KHÔNG MFA / IP allowlist** — từ chối:
  - Vẫn có boundary tốt hơn merged, nhưng 1 credential leak = full breach cross-tenant. MFA + IP allowlist là rẻ (~1 ngày setup) so với cost of breach.
  - 8h refresh TTL cũng vậy — rẻ mà hiệu quả.

- **SaaS BFF NestJS riêng (`apps/checkin-admin-api`)** — từ chối:
  - Quá nhiều moving parts cho MVP: 1 BFF process riêng, 1 Dockerfile riêng, 1 health check, 1 deployment, monitoring riêng.
  - Reuse `apps/api-gateway` chỉ thêm 1 module `checkin-admin/` là đủ — cost thấp hơn nhiều, vẫn đạt mục tiêu.
  - Phase 8+ nếu cần tách thật sự (vd checkin-admin cần scale riêng, có team riêng phát triển) thì cân nhắc.

- **CLI / Retool / Metabase ngoài** — từ chối:
  - Workaround chứ không phải giải pháp: không self-service, support chậm (mỗi ticket phải viết SQL), không audit trail tốt.
  - Phù hợp khi team < 1 người platform và budget không cho phép build UI; team SaasCheckin 2-3 dev có thể absorb.

- **Mở rộng Identity context thêm `PlatformUser` thay vì context mới** — từ chối:
  - Identity context phình to, lẫn concern tenant + platform.
  - Khó enforce "PlatformUser KHÔNG reference `User` aggregate" bằng NetArchTest.
  - Aggregate `User` đã có nhiều method (change password, update email, verify email, …) — thêm platform concern sẽ rối.

- **App monolith `apps/saas-console` gộp cả tenant + platform** — từ chối:
  - Tệ nhất: bundle 2 audience vào 1, lặp lại vấn đề merged.

## Pattern tham chiếu

- [Vercel: Separating customer-facing and admin UIs](https://vercel.com/blog/how-vercel-builds-the-admin-dashboard) — pattern tách admin app, dùng chung design system
- [GitHub: Separate enterprise console](https://github.com) — github.com vs enterprise.github.com là 2 codebase
- [Stripe: Dashboard + Sigma + Atlas](https://stripe.com/docs/dashboard) — 3 audience khác nhau, 3 codebase
- [Supabase: Studio tách khỏi app](https://supabase.com/docs/guides/platform) — admin Studio là 1 web app riêng

## Anti-pattern enforce

- **NetArchTest:** `PlatformOperations.Domain` KHÔNG reference `Identity.Domain` hay `Billing.Domain`. Chỉ giao tiếp qua integration event.
- **ESLint:** `apps/web/src/` KHÔNG import từ `apps/checkin-admin/src/` và ngược lại. `no-restricted-imports` rule.
- **CI:** integration test tự động gọi 401 khi checkin-admin JWT gọi tenant endpoint, và ngược lại.
- **Migration Postgres:** `app_platform_owner` chỉ được INSERT/SELECT trên `platform_audit_log`, không UPDATE/DELETE. Revoked ngay từ migration đầu.

## Migration path

- **Phase 0:** skeleton `apps/checkin-admin` (I-013b) + ADR này + Postgres role `app_platform_owner` tạo sẵn (qua migration Phase 1).
- **Phase 1:** `PlatformUser` + `PlatformSession` aggregate (I-106) + BFF auth module (I-107) + Next.js auth pages (I-108) + MFA setup flow. Super-admin có thể login + setup MFA + vào dashboard trống.
- **Phase 5-6:** `PlatformAuditEntry` aggregate + full feature (tenants list, suspend, refund, impersonation, plan CRUD, feature flags, metrics).
- **Phase 8+:** revisit nếu duplication thành gánh nặng (share `packages/ui/`).

## Revisit if

- Maintenance 2 Next.js app quá tải (> 5 component shared/tháng cần sync) → share `packages/ui/` (vẫn giữ 2 app).
- Audit log bị xóa dù đã revoke grant → alert + thêm immutability bằng hash chain / WORM storage.
- Cần compliance SOC 2 / ISO 27001 → thêm HITRUST-friendly control (session recording cho checkin-admin, immutable log shipping sang SIEM).
- Team platform < 1 người và traffic cực thấp → cân nhắc lại merged option (downgrade D12).
- `apps/checkin-admin` cần scale riêng (vd > 100 user hoặc tách team platform) → tách `apps/checkin-admin-api` BFF NestJS riêng.

## Updates

- **2026-06-05** — Persona set được chuẩn hoá thành **5 role** (Owner / Admin / Organizer / Staff / Viewer) theo [ADR-0015](./0015-rbac-hybrid-permissions.md). "Gate" bị loại bỏ khỏi role set (Gate là khái niệm vật lý — `venues.gates`, không phải role); kiosk-only mode giờ là **per-user setting** trên Staff, không phải role riêng. Decision D12 (tách checkin-admin app) không thay đổi.

## References

- [`docs/checkin-admin.md`](../checkin-admin.md) — chi tiết layout + module + permission matrix
- [`docs/01-architecture.md`](../01-architecture.md) — sơ đồ 2 app + 2 gRPC channel
- [`docs/02-tech-stack.md`](../02-tech-stack.md) § Check-in Admin App — tech stack rationale
- [`docs/03-monorepo.md`](../03-monorepo.md) § `apps/checkin-admin/` — cây thư mục
- [`docs/05-database.md`](../05-database.md) § Pattern kết nối — 2 Postgres role
- [`docs/06-api.md`](../06-api.md) § Super-admin — REST endpoint + gRPC channel
- [`docs/04-bounded-contexts.md`](../04-bounded-contexts.md) § PlatformOperations — context mới
- [`docs/11-risks.md`](../11-risks.md) — risk #18-23 liên quan
- [`docs/issues/phase-0-foundation.md`](../issues/phase-0-foundation.md) — I-013b checkin-admin skeleton
- [`docs/issues/phase-1-identity.md`](../issues/phase-1-identity.md) — I-106, I-107, I-108
- [0013-dotnet-core-10-ddd.md](./0013-dotnet-core-10-ddd.md) — ADR trước (D3)
