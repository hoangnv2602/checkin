# 00 · Tổng quan

## Sản phẩm

SaaS đa tenant cho check-in sự kiện. Mỗi **organization** (tenant) tạo sự kiện, bán vé, và vận hành check-in tại chỗ qua quét QR trên app di động, kèm dashboard web realtime cho staff.

## Tính năng cốt lõi (MVP)

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | Đa tenant | Một organization = một tenant. Dữ liệu cô lập bằng `tenant_id` + Postgres RLS. |
| 2 | Quản lý sự kiện | CRUD sự kiện, session, venue, capacity. |
| 3 | Bán vé | Loại vé, giá, số lượng, mã giảm giá. |
| 4 | Đăng ký | Flow đăng ký công khai + custom form field. |
| 5 | Check-in QR | QR ký Ed25519; quét bằng app Flutter; chống giả mạo & chống replay. |
| 6 | Dashboard realtime | Dashboard WebSocket cho thống kê check-in trực tiếp. |
| 7 | Check-in offline | Mobile queue check-in local, sync khi online. |
| 8 | RBAC | Role Owner / Admin / Organizer / Staff / Viewer. Chi tiết hybrid permission model: [ADR-0015](./adr/0015-rbac-hybrid-permissions.md). |
| 9 | Billing | Subscription Stripe + VNPay; gói Free / Pro / Enterprise. |
| 10 | Báo cáo | Tổng check-in, tỉ lệ no-show, peak gate, time-to-checkin. |

## Nguyên tắc thiết kế

- **Tinh khiết domain:** Business rule nằm trong .NET Core 10 (DDD layered, custom base class); aggregate không phụ thuộc framework.
- **Pattern BFF:** NestJS gateway chỉ làm I/O — không bao giờ chứa business rule.
- **Realtime-first:** Redis Pub/Sub + Socket.IO cho dashboard.
- **Check-in idempotent:** Một QR thành công đúng một lần. Retry trả 409, không ghi đúp.
- **Server là source of truth:** Mobile có thể verify offline nhưng không mint check-in khi chưa có ack từ server.

## User persona

Có **2 nhóm audience** rõ rệt, mỗi nhóm có 1 app Next.js riêng:

### Nhóm 1 — Trong 1 tenant (audience của `apps/web`)

- **Owner** — Admin org. Toàn quyền. Quản lý billing, member, mọi event. Mỗi tenant có đúng 1 Owner (không revoke được, chỉ transfer).
- **Admin** — Quản lý member, settings, billing (trừ cancel subscription). Không thấy audit log cross-org (Owner-only).
- **Organizer** — Người tạo event. CRUD event/ticket type, xem báo cáo, undo check-in, refund.
- **Staff** — Vận hành event được assign. Quét QR, manual check-in (kèm lý do), xem lịch sử của mình.
- **Viewer** — Read-only. Xem dashboard, báo cáo, danh sách registration. Không quét, không sửa.

> Lưu ý: "kiosk mode" (chỉ quét, không manual override) là **per-user setting** trên Staff, không phải role riêng. Gate là khái niệm vật lý (`venues.gates`), không phải role.

### Nhóm 2 — Vận hành SaaS (audience của `apps/checkin-admin`)

- **Platform Owner** — Người chạy SaaS. Toàn quyền cross-tenant: list tenant, suspend, refund, xem global metrics, manage plan, feature flag.
- **Platform Support** — Hỗ trợ khách hàng. View audit log, impersonate (có log), refund thay khách khi bị kẹt, không được xoá data hộ.
- **Platform Engineer** — Vận hành hệ thống. Xem log/metric/trace, replay integration event, drain queue.

> **Quan trọng:** "Owner" ở nhóm 1 KHÁC "Platform Owner" ở nhóm 2. Owner quản 1 tenant, Platform Owner quản cả SaaS. Hai role không bao giờ dùng chung UI, JWT, hay BFF endpoint. ADR: [`0014-checkin-admin-app.md`](./adr/0014-checkin-admin-app.md).

## Ngoài phạm vi (MVP)

Xem [`12-out-of-scope.md`](./12-out-of-scope.md). Tóm tắt: không có native iOS/Android (chỉ Flutter), không có app mobile cho attendee (chỉ staff), không AI/nhận diện khuôn mặt, không multi-region.
