# Multi-region routing (I-902)

> **Phase 9 — Platform Maturity.** Enterprise tenant chọn data region (eu/sg/us/au).
> Default `eu` cho free/pro. Cross-region replication out of scope (Phase 10+).

## Region codes

| Code | Mô tả | Production region |
|------|-------|-------------------|
| `eu` | Europe (Hetzner FSN1) — **default** | Hetzner EU |
| `sg` | Singapore (planned) | reserved |
| `us` | US East (planned) | reserved |
| `au` | Australia (planned) | reserved |

Phase 9 chỉ `eu` thật sự serve traffic. Các code khác reserved cho khách hàng
Enterprise đã ký data residency addendum; BFF vẫn resolve + route, nhưng
replica pool / gRPC client sẽ fallback về `eu` cho đến khi region deployment
hoàn tất (Phase 10).

## Plan gate

| Plan | Regions khả dụng |
|------|-------------------|
| Free | `eu` |
| Pro | `eu` |
| Enterprise | `eu`, `sg`, `us`, `au` |
| Internal | tất cả |

JWT `data_region` claim ngoài danh sách plan → fallback `eu` + log warning.

## Resolution order

```
1. X-Tenant-Region header      (operator override — chỉ dùng migration)
2. JWT claim data_region       (tenant's home region)
3. Redis cache tenant:region:* (TTL 10 phút)
4. Env TENANT_DEFAULT_REGION_* (per-tenant override, plan-gated)
5. Default by plan             (free/pro → eu, ent → eu)
```

## Wire integration

- `TenancyModule` (BFF): chain `DomainResolverMiddleware` → `RegionResolverMiddleware` global.
- `req.region` (object `{ region, source }`) attached cho downstream.
- `IdbContextProvider` (core-api, I-805) đọc region header từ gRPC metadata → pick replica pool.
- BFF gRPC client (`apps/api-gateway/src/modules/core-api/`) forward `x-tenant-region` metadata.

## Why this design

- **Defense in depth**: plan gate enforce cả ở JWT verify + region resolver.
- **Cached fast path**: Redis TTL 10 phút — region hiếm khi đổi, không cần gRPC
  call mỗi request.
- **Header override** chỉ cho operator: không expose cho tenant — bảo đảm audit
  trail + GDPR consent.
- **Env override** thay vì DB lookup: enterprise sales team set env var khi
  onboard, không cần migration mỗi lần thêm region.

## Future (Phase 10+)

- Multi-region Postgres (Patroni cluster per region)
- Cross-region read replica (Bucardo / logical replication)
- Tenant onboarding flow chọn region qua UI
- Region migration playbook: copy primary → promote → re-point DNS
