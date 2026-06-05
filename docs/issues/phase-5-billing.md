# Phase 5 — Billing & SaaS Layer (Tuần 11–12)

> **Mục tiêu:** Tenant subscribe plan; plan limit được enforce; trang billing trong dashboard.
> **Phụ thuộc:** Phase 3 (payment provider hoạt động), Phase 4 (event bán được vé).

## Backlog

### I-501 · [L] .NET Core 10 Billing context (bounded-context module)
- Aggregate (trong `src/SaasCheckin.Domain/Billing/Aggregates/`): `Subscription`, `Invoice`, `Plan`
- VO (record): `Money`, `BillingPeriod`, `PlanTier`
- Domain service: `IPlanLimitEnforcer` (check limit trước khi mutation)
- Use case: `SubscribeToPlan`, `CancelSubscription`, `UpgradePlan`, `RecordInvoice` (MediatR command handler)
- Domain event: `SubscriptionActivated`, `SubscriptionCancelled`, `PlanLimitExceeded`
- Integration event: `SubscriptionCancelledIntegrationEvent` (consume từ `Identity` context để tự động suspend org khi trial hết)
- State machine subscription: `Active → PastDue → Cancelled` dùng **Stateless** library
- Plan limit: max active event, max attendees/tháng, max staff seat — lưu trong bảng `plans`; `PlanLimitEnforcer` query qua `ISubscriptionRepository`
- Webhook handler: Stripe subscription event + tương đương VNPay (nếu có) trong `SaasCheckin.HttpApi.Host/Controllers/Billing/WebhookController.cs`

### I-502 · [M] Middleware enforce plan
- Trong api-gateway: check usage hiện tại vs plan limit trước khi mutate
- Trả 402 (Payment Required) với `code: plan_limit_exceeded` + `details: { limit, current }`
- Áp cho: `CreateEvent`, `RegisterAttendee` (đếm), `InviteMember` (đếm)
- Cache limit trong Redis với TTL 5 phút; invalidate khi subscription đổi

### I-503 · [M] Trang billing (Next.js)
- `/[orgSlug]/billing` — plan hiện tại, usage meter, CTA upgrade
- `/[orgSlug]/billing/invoices` — list phân trang có download
- `/[orgSlug]/billing/payment-method` — quản lý thẻ / tài khoản VNPay
- Stripe Customer Portal redirect để quản lý thẻ
- VNPay: link tới UI quản lý ngân hàng

### I-504 · [M] Trial + free tier
- Org mới tự động có trial Pro 14 ngày
- Free tier: 1 active event, 50 attendees/tháng, 3 staff seat
- Trial hết hạn → downgrade về Free (read-only trên data cũ)
- Email reminder: 3 ngày trước, 1 ngày trước, ngày hết hạn

### I-505 · [M] Test
- Integration test plan limit enforcement
- Webhook Stripe → chuyển trạng thái subscription
- Trial hết hạn → flow downgrade

---

## Definition of Done

- [ ] Org mới bắt đầu trial Pro 14 ngày
- [ ] Chạm plan limit trả 402 với error rõ ràng
- [ ] Webhook subscription Stripe cập nhật aggregate `Subscription`
- [ ] Cancel subscription → tenant downgrade cuối kỳ
- [ ] Trang billing hiển thị usage chính xác
- [ ] Mọi test Phase 5 xanh trên CI
