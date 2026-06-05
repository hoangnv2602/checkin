# 12 · Ngoài phạm vi (Out of Scope) — MVP

Những mục dưới đây **không** nằm trong MVP 16 tuần. Nếu có tính năng lẻn vào, cần re-scope.

> **Lưu ý:** Super-admin UI (`apps/checkin-admin`) **ĐÃ nằm trong scope** (D12, ADR-0014). Skeleton ở Phase 0-1, full feature ở Phase 5-6. Mục dưới đây chỉ defer các tính năng nhỏ của checkin-admin, không defer toàn bộ.

## Loại trừ

- **App native iOS / Android** — chỉ Flutter
- **App mobile cho attendee** — chỉ dành cho staff check-in. Attendee xem QR qua web (`/e/{slug}/ticket/{regId}`)
- **Marketplace / chương trình affiliate** cho organizer
- **Tính năng AI** — nhận diện khuôn mặt, anomaly detection, smart photo tagging
- **White-label custom domain đầy đủ** — một brand duy nhất ở MVP
- **Multi-region / cross-DC replication** — chỉ một region (Hetzner EU)
- **Chat / networking realtime giữa attendee** tại sự kiện
- **Live streaming / virtual event**
- **Quản lý sponsor / booth**
- **Trình thiết kế vé tùy chỉnh** — template cố định ở MVP
- **UI email builder** — template cố định; chỉ branding theo tenant
- **Public API cho bên thứ ba**
- **Mobile SDK để nhúng vào app khác**
- **Public status page** — chỉ Uptime Kuma nội bộ ở MVP
- **SSO / SAML cho tenant** — chỉ email+password và magic link ở MVP
- **UI audit log cho end user** — chỉ truy cập nội bộ ở Phase 6
- **Webhook cho tenant** (vd: emit `event.published` về URL khách hàng) — Phase 8+
- **UI refund flow cho tenant** — backend hỗ trợ, UI hoãn sang Phase 8
- **Multi-currency** — chỉ VND + USD; tenant chọn một
- **Tính thuế** — tenant chỉ định inclusive/exclusive + flat rate
- **Tối thiểu PCI scope** — dùng trang hosted của Stripe / VNPay (không lưu thẻ)

## Hoãn sang Phase 8+ (sau MVP)

- Rate limit API per-tenant với quota cấu hình được
- Hệ thống webhook delivery cho tenant integration
- Custom field builder cho form đăng ký
- Sự kiện lặp / chuỗi sự kiện
- Sub-orgs / mô hình franchise
- Offline mode cho dashboard organizer
- App mobile cho attendee tích hợp wallet
- Super-admin impersonate từ mobile
- Super-admin write API bằng GraphQL (giữ REST + gRPC)
