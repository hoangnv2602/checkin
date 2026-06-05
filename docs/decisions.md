# Sổ quyết định (D1–D13)

12 quyết định đầu (D1–D12) chốt ngày 2026-06-04. D13 chốt ngày 2026-06-05. Mỗi cái có ADR tương ứng trong [`adr/`](./adr/).

| ID | Quyết định | Kết luận | ADR |
|----|------------|----------|-----|
| **D1** | Mô hình tenancy | **Row-level với `tenant_id` + Postgres RLS** | [0003-tenancy-row-level-rls.md](./adr/0003-tenancy-row-level-rls.md) |
| **D2** | Auth | **Custom JWT (RS256) + refresh rotation** | [0004-auth-custom-jwt.md](./adr/0004-auth-custom-jwt.md) |
| **D3** | Topology backend | **NestJS (BFF) + .NET Core 10 (DDD layered core, custom base class)** | [0013-dotnet-core-10-ddd.md](./adr/0013-dotnet-core-10-ddd.md) (supersedes 0001) |
| **D4** | Thanh toán | **Stripe + VNPay qua `PaymentProviderInterface`** | [0005-payment-multiprovider.md](./adr/0005-payment-multiprovider.md) |
| **D5** | Nền tảng mobile | **iOS + Android (Flutter) cùng lúc** | [0006-mobile-flutter-both.md](./adr/0006-mobile-flutter-both.md) |
| **D6** | Hosting | **On-prem / VPS (Hetzner + Docker Compose + Ansible)** | [0007-hosting-onprem-vps.md](./adr/0007-hosting-onprem-vps.md) |
| **D7** | Style API | **REST + OpenAPI code-gen (không GraphQL)** | [0008-api-rest-openapi.md](./adr/0008-api-rest-openapi.md) |
| **D8** | Comms | **Resend (email) + Twilio (SMS)** | [0009-comms-resend-twilio.md](./adr/0009-comms-resend-twilio.md) |
| **D9** | Quản lý state Flutter | **BLoC + Cubit** (không Riverpod) | [0010-frontend-state-bloc.md](./adr/0010-frontend-state-bloc.md) |
| **D10** | Tổ chức code Next.js | **Feature module** (`apps/web/src/modules/<module>/`) | [0011-frontend-feature-modules.md](./adr/0011-frontend-feature-modules.md) |
| **D11** | Design system | **Custom palette "Aurora" + shadcn CLI workflow** (không dùng màu mặc định) | [0012-design-system-aurora-shadcn-cli.md](./adr/0012-design-system-aurora-shadcn-cli.md) |
| **D12** | Check-in admin app | **`apps/checkin-admin` Next.js riêng (tách khỏi `apps/web`); subdomain `admin.*`; MFA bắt buộc; Postgres role `app_platform_owner` BYPASSRLS; context mới `PlatformOperations`; audit log bất di bất dịch** | [0014-checkin-admin-app.md](./adr/0014-checkin-admin-app.md) |
| **D13** | RBAC tenant (hybrid) | **Permission keys hard-coded (compile-time safe, ~50 keys theo bounded context); role → permissions mapping là static dictionary 1 nguồn truth; 5 default role (Owner/Admin/Organizer/Staff/Viewer); `memberships.role` ENUM → VARCHAR(40) trong migration đầu Phase 1; BFF NestJS chỉ làm authn (`JwtAuthGuard`) — KHÔNG check permission; .NET `PermissionBehavior` là AUTHORITATIVE authz layer duy nhất; defense in depth cùng .NET authz + DB RLS; custom role per tenant defer Phase 2+** | [0015-rbac-hybrid-permissions.md](./adr/0015-rbac-hybrid-permissions.md) |

## Design system (D11)

- Palette: **Aurora** — primary Electric Indigo (`#5b4dee`) + accent Sunset Coral (`#ff6b35`)
- Mọi màu là semantic token; cấm dùng class palette Tailwind thô
- Mọi component shadcn được thêm qua `yarn dlx shadcn@latest add <name>` (không tự viết tay)
- Spec đầy đủ: [`docs/design-system.md`](./design-system.md)

## Khi nào revisit

| Trigger | Đánh giá lại quyết định |
|---------|-------------------------|
| Team < 3 dev cuối Phase 3 | D3 (gộp lại chỉ giữ .NET, NestJS thành gateway mỏng) |
| > 5k MAU hoặc cần HA | D6 (migrate AWS / GCP) |
| Provider thanh toán mới >10% doanh thu | D4 (thêm adapter; không thay) |
| Customer đầu tiên cần on-prem | D6 (đã on-prem, không đổi) |
| Cần multi-region cho latency | D6 + D1 (thêm region, tenant routing) |
| User mobile phàn nàn về offline UX | D5 (đánh giá lại native vs Flutter) |
| Hire mới chỉ biết Riverpod | D9 (cân nhắc Riverpod cho module mới) |
| Library Next.js thứ 3 yêu cầu `components/` phẳng | D10 (cho phép escape hatch mỗi module) |
| Palette Aurora cảm thấy lệch brand sau 6 tháng | D11 (lặp token, giữ semantic) |
| Maintenance 2 Next.js app quá tải (vd > 5 component shared/tháng cần sync) | D12 (cân nhắc share `packages/ui/`; vẫn giữ 2 app) |
| Audit log bị delete dù đã revoke grant | D12 (alert + investigation; thêm immutability bằng hash chain hoặc WORM storage) |
| Cần compliance SOC 2 / ISO 27001 | D12 + thêm HITRUST-friendly control (vd session recording cho checkin-admin) |

## ADR đang chờ (đã viết ở Phase 0)

- `0001-stack-and-bff.md` — D3 (Superseded by 0013)
- `0002-ddd-style.md` — hướng dẫn style DDD tactical (Superseded by 0013)
- `0003-tenancy-row-level-rls.md` — D1
- `0004-auth-custom-jwt.md` — D2
- `0005-payment-multiprovider.md` — D4
- `0006-mobile-flutter-both.md` — D5
- `0007-hosting-onprem-vps.md` — D6
- `0008-api-rest-openapi.md` — D7
- `0009-comms-resend-twilio.md` — D8
- `0010-frontend-state-bloc.md` — D9
- `0011-frontend-feature-modules.md` — D10
- `0012-design-system-aurora-shadcn-cli.md` — D11
- `0013-dotnet-core-10-ddd.md` — D3 (mới)
- `0014-checkin-admin-app.md` — D12 (mới)
- `0015-rbac-hybrid-permissions.md` — D13 (mới, 2026-06-05)
