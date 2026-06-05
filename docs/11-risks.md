# 11 · Sổ rủi ro (Risk Register)

| # | Rủi ro | Tác động | Giảm thiểu | Người phụ trách |
|---|--------|----------|------------|------------------|
| 1 | Hai backend là quá thừa cho team nhỏ, tăng chi phí vận hành | Giao hàng chậm | Gộp lại nếu team < 3 dev; đánh giá lại cuối Phase 3 | Tech lead |
| 2 | Check-in offline xung đột với trạng thái server | Mất check-in hoặc check-in trùng | Idempotency key + server reconciliation; audit trail đầy đủ | Mobile lead |
| 3 | QR bị lộ / photocopy → gian lận | Vào cửa trái phép | Chữ ký Ed25519, JTI single-use, tùy chọn QR xoay mỗi 30s | Backend lead |
| 4 | Rò rỉ dữ liệu giữa các tenant | **Nghiêm trọng** | RLS ở DB level + EF Core `TenantDbConnectionInterceptor` tự set `app.current_tenant`; test schema isolation trên mỗi migration; checklist review PR | Backend lead |
| 5 | EF Core lazy loading trong aggregate | N+1, deadlock | Method repository tường minh có fetch join (`Include`); không inject DbContext vào aggregate | Backend lead |
| 6 | Lệch serialization giữa NestJS ↔ .NET Core 10 | Bug runtime | Proto + codegen làm single source of truth (`buf generate` cho cả 2 phía); contract test trong CI | Platform |
| 7 | Nghẽn WebSocket (5k+ staff trên 1 event) | Dashboard đứng | Redis adapter + sticky session; tách cluster WS riêng ở 10k+ | Backend lead |
| 8 | Webhook Stripe bị trùng | Tính tiền 2 lần | Idempotency key + DB unique constraint trên `(provider, provider_event_id)` | Backend lead |
| 9 | Review chậm trên App Store / Play Store (iOS / Android) | Trễ release | TestFlight + Internal Testing từ cuối Phase 4; submit sớm | Mobile lead |
| 10 | Vendor lock-in (Resend, Twilio, Stripe, VNPay) | Chi phí migrate | Adapter interface ngay từ ngày đầu | Tech lead |
| 11 | On-prem single point of failure (1 VPS app + 1 VPS db) | Downtime nếu node chết | pgbackrest daily + WAL streaming về Storage Box; playbook rebuild ≤ 30 phút; health check → Telegram/Discord | DevOps |
| 12 | VNPay IPN không tới server (firewall / downtime) | Order kẹt pending | Fallback poll mỗi 5 phút cho order pending > 10 phút; client hiển thị "đang chờ xác nhận" | Backend lead |
| 13 | Bypass RLS vì dev quên set `app.current_tenant` | Lộ chéo tenant | EF Core `TenantDbConnectionInterceptor` chạy tự động mỗi connection open; `ICurrentTenant` ambient scope ở middleware; migration test tự tạo 2 tenant, assert isolation; checklist review PR; NetArchTest bắt aggregate không depend DbContext | Backend lead |
| 14 | Postgres single instance (không HA) ở MVP | ~5 phút downtime nếu crash | Document migration sang Patroni / Cloud SQL khi doanh thu cho phép; alert monitoring trong vòng 1 phút | DevOps |
| 15 | Lệch giờ giữa thiết bị staff và server phá check QR `exp` | Từ chối QR hợp lệ | Dùng NTP trên thiết bị; cho phép skew ±60s phía server | Mobile lead |
| 16 | GDPR / data residency trên Hetzner EU so với user VN | Rủi ro pháp lý | Cho phép chọn region tenant (EU / SG) khi migrate sang multi-region | Tech lead |
| 17 | Custom base class DDD drift khỏi DDD best practice | Pattern không nhất quán giữa các context | NetArchTest enforce layering trong CI; onboarding doc `docs/api/building-blocks.md`; code review checklist aggregate không depend framework | Tech lead |
| 18 | Super-admin credential leak → attacker toàn quyền cross-tenant | **Nghiêm trọng** | MFA TOTP bắt buộc; IP allowlist ở Cloudflare WAF cho `admin.*`; refresh token TTL 8h (vs tenant 30d); audit log bất di bất dịch mọi mutation; security review định kỳ secret rotation; KHÔNG share JWT signing key audience với tenant | Platform eng |
| 19 | `BYPASSRLS` role bị lạm dụng ngoài scope checkin-admin | Lộ chéo tenant từ app code | 2 connection factory tách biệt trong DI; gRPC metadata `x-platform-role: true` mới dùng platform factory; test tự động verify role không lẫn; NetArchTest bắt module PlatformOperations không gọi `app_runtime` connection; revoke UPDATE/DELETE trên `platform_audit_log` ngay từ migration đầu | Backend lead |
| 20 | Super-admin impersonation bị lạm dụng đánh cắp data tenant | Rủi ro pháp lý + uy tín | Impersonate max 30 phút/session, single session, bắt buộc nhập lý do, ghi `platform_audit_log`; phát hiện impersonation qua role claim `is_impersonated: true` ở tenant JWT; mọi action trong phiên impersonate vẫn ghi tenant audit log gắn actor là platform user | Platform eng |
| 21 | Audit log gap (mutation không ghi log) | Forensic không truy vết được | Trigger Postgres ở `platform_audit_log` insert-on-mutation cho table PlatformOperations; middleware .NET auto-insert cho mọi HTTP POST/PATCH/DELETE; integration test 100% endpoint phải sinh audit row; alert nếu >1h không có audit row mới (có thể trigger bị disable) | Backend lead |
| 22 | Code duplication 2 Next.js app (`apps/web` + `apps/checkin-admin`) tăng maintenance | Tốn effort update component, dễ drift UI | Aurora tokens + shadcn CLI sync bằng script copy có review; component generic (Button, Card, Dialog, Table) chia sẻ pattern; revisit Phase 6+ xem có nên share qua `packages/ui/` | Frontend lead |
| 23 | Dev nhầm route checkin-admin vào tenant app (hoặc ngược lại) | Permission leak | CODEOWNERS tách (`@team/platform-eng` cho `apps/checkin-admin/`); ESLint rule cấm import cross-app; integration test tự động gọi 401 khi checkin-admin JWT gọi tenant endpoint; tự động scan secret / cookie domain trong CI | Frontend lead |

## Cadence review

- Review vào cuối mỗi phase
- Cập nhật mức độ nghiêm trọng (tác động × khả năng xảy ra) và xếp hạng lại
- Rủi ro mới phát hiện được thêm vào ngay lập tức
