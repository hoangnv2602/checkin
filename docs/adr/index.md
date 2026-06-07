# Architecture Decision Records

Mọi quyết định kiến trúc quan trọng đều có một ADR. Mỗi ADR giải thích:

1. **Context** — vấn đề cần giải quyết, ràng buộc.
2. **Decision** — chọn gì, tại sao.
3. **Consequences** — trade-off, hệ quả (positive + negative).
4. **Status** — Accepted / Superseded by ADR-XXXX.

## Index

| ID | Title | Status |
|----|-------|--------|
| [ADR-0001](0001-stack-and-bff.md) | Stack chọn Next.js + NestJS + .NET Core 10 | Accepted |
| [ADR-0002](0002-ddd-style.md) | DDD layered architecture cho core-api | Accepted |
| [ADR-0003](0003-tenancy-row-level-rls.md) | Multi-tenant bằng Postgres RLS | Accepted |
| [ADR-0004](0004-auth-custom-jwt.md) | Custom JWT (RS256) thay vì NextAuth | Accepted |
| [ADR-0005](0005-payment-multiprovider.md) | PaymentProviderInterface + Stripe + Vnpay | Accepted |
| [ADR-0006](0006-mobile-flutter-both.md) | Flutter cho cả iOS + Android | Accepted |
| [ADR-0007](0007-hosting-onprem-vps.md) | Hetzner VPS thay vì AWS/GCP | Accepted |
| [ADR-0008](0008-api-rest-openapi.md) | REST + OpenAPI 3.1 (không GraphQL) | Accepted |
| [ADR-0009](0009-comms-resend-twilio.md) | Resend (email) + Twilio (SMS) | Accepted |
| [ADR-0010](0010-frontend-state-bloc.md) | BLoC + Cubit cho mobile (không Riverpod) | Accepted |
| [ADR-0011](0011-frontend-feature-modules.md) | Feature modules cho Next.js (D10) | Accepted |
| [ADR-0012](0012-design-system-aurora-shadcn-cli.md) | Aurora design system + shadcn CLI (D11) | Accepted |
| [ADR-0013](0013-dotnet-core-10-ddd.md) | .NET Core 10 DDD bounded contexts | Accepted |
| [ADR-0014](0014-checkin-admin-app.md) | Tách `apps/checkin-admin` cho platform owner | Accepted |
| [ADR-0015](0015-rbac-hybrid-permissions.md) | RBAC hybrid: global role + per-org role | Accepted |

## Thêm ADR mới

```bash
# Dùng template tại docs/adr/_template.md
cp docs/adr/_template.md docs/adr/0016-<kebab-title>.md
# Chỉnh sửa nội dung, mở PR. Tech lead review.
```

ADR phải được review bởi ít nhất 1 senior trước khi merge. Không tự ý sửa ADR đã accepted — nếu cần thay đổi, viết ADR mới ghi "Supersedes ADR-XXXX".
