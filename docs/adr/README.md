# Architecture Decision Records

Folder này chứa các ADR cho nền tảng SaaS event check-in. Mỗi ADR ghi lại một quyết định kiến trúc quan trọng, context và hệ quả của nó.

## Index

| # | Tiêu đề | Quyết định | Status |
|---|----------|------------|--------|
| [0001](./0001-stack-and-bff.md) | Stack & BFF topology | NestJS (BFF) + Symfony 8.x (DDD core) | **Superseded by 0013** |
| [0002](./0002-ddd-style.md) | DDD tactical style | Aggregate + Value Object + Domain Event + Outbox | **Superseded by 0013** |
| [0003](./0003-tenancy-row-level-rls.md) | Mô hình tenancy | Row-level + Postgres RLS | Accepted (D1) |
| [0004](./0004-auth-custom-jwt.md) | Authentication | Custom JWT (RS256) + refresh rotation | Accepted (D2) |
| [0005](./0005-payment-multiprovider.md) | Payment provider | Stripe + VNPay qua `IPaymentProvider` | Accepted (D4) |
| [0006](./0006-mobile-flutter-both.md) | Nền tảng mobile | Flutter, iOS + Android cùng lúc | Accepted (D5) |
| [0007](./0007-hosting-onprem-vps.md) | Topology hosting | On-prem VPS (Hetzner) + Docker Compose + Ansible | Accepted (D6) |
| [0008](./0008-api-rest-openapi.md) | Style API | REST + OpenAPI 3.1, không GraphQL | Accepted (D7) |
| [0009](./0009-comms-resend-twilio.md) | Email & SMS | Resend + Twilio | Accepted (D8) |
| [0010](./0010-frontend-state-bloc.md) | State management Flutter | BLoC + Cubit (không Riverpod) | Accepted (D9) |
| [0011](./0011-frontend-feature-modules.md) | Tổ chức code Next.js | Feature module (`apps/web/src/modules/<module>/`) | Accepted (D10) |
| [0012](./0012-design-system-aurora-shadcn-cli.md) | Design system | Palette Aurora tuỳ chỉnh + shadcn CLI workflow | Accepted (D11) |
| [0013](./0013-dotnet-core-10-ddd.md) | Core API: .NET Core 10 + DDD layered | NestJS (BFF) + .NET Core 10 (DDD layered, custom base class) | **Accepted (D3 — supersedes 0001, 0002)** |
| [0014](./0014-checkin-admin-app.md) | Check-in admin app | `apps/checkin-admin` Next.js riêng; MFA + IP allowlist; Postgres role `app_platform_owner` BYPASSRLS; context mới `PlatformOperations`; audit log bất di bất dịch | **Accepted (D12)** |
| [0015](./0015-rbac-hybrid-permissions.md) | RBAC tenant (hybrid) | Permission keys hard-coded; role → permissions mapping static dictionary; 5 default role (Owner/Admin/Organizer/Staff/Viewer); `memberships.role` ENUM → VARCHAR(40); BFF NestJS chỉ authn (không check permission); .NET `PermissionBehavior` là authoritative authz; custom role per tenant defer Phase 2+ | **Accepted (D13)** |

## Workflow

1. Copy [`template.md`](./template.md) thành file mới `NNNN-short-kebab-title.md`
2. Điền Status, Context, Decision, Consequences
3. Mở PR; yêu cầu 1 approval từ `@team/tech-leads`
4. Khi merge, thêm dòng vào index phía trên

## Khi nào viết ADR

- Chọn framework, library, hoặc vendor
- Một pattern không tầm thường ràng buộc code tương lai (vd mô hình tenancy)
- Thay đổi process ảnh hưởng cả team (flow CI, branching)
- Đảo ngược hoặc sửa lớn một ADR trước (link ADR cũ trong "Supersedes")

Bug fix hoặc implement feature thông thường **không** cần ADR.

## Quy ước đặt tên

- Sequence 4 chữ số zero-padded (`0001`, `0002`, …)
- Tiêu đề kebab-case
- Status: `Proposed` → `Accepted` (hoặc `Rejected` / `Superseded by NNNN`)
