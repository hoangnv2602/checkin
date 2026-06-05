# Phase 3 — Ticketing & Đăng ký công khai (Tuần 6–7)

> **Mục tiêu:** Công chúng có thể đăng ký event đã publish, thanh toán qua Stripe hoặc VNPay, nhận vé kèm QR qua email.
> **Phụ thuộc:** Phase 2 (Events).

## Backlog

### I-301 · [L] .NET Core 10 Registration context (bounded-context module)
- Aggregate (trong `src/SaasCheckin.Domain/Registration/Aggregates/`): `TicketType` (root), `Order`, `Registration`
- VO (record): `Money` (currency-aware), `DiscountCode`, `QrPayload`, `QrSignature`
- Domain service: `IPricingService`, `IQrCodeGenerator` (Ed25519 dùng `NSec.Cryptography` hoặc `Org.BouncyCastle.Cryptography`)
- Use case (MediatR command handler): `CreateTicketType`, `RegisterAttendee`, `CreateOrder`, `ApplyDiscount`, `IssueTicket`, `MarkOrderPaid`
- Event: `TicketIssued`, `TicketRevoked`, `OrderPaid`, `OrderFailed` (in-process) + `TicketIssuedIntegrationEvent`, `OrderPaidIntegrationEvent` (cross-service qua MassTransit)
- gRPC: `TicketTypeService`, `OrderService`, `RegistrationService`
- RLS trên mọi bảng

### I-302 · [L] PaymentProviderInterface + adapter
- Interface trong `api-gateway/src/modules/billing/payments/payment-provider.interface.ts` (xem ADR-0005)
- `StripeAdapter` — PaymentIntent + verify chữ ký webhook
- `VnpayAdapter` — VNPay API + verify IPN (`vnp_SecureHash` SHA512)
- Cả hai ghi vào cùng bảng `payments` với enum `provider` + idempotency key
- `WebhookRouter` dispatch theo signature/path
- Worker poll payment fail (order pending > 10 phút)
- `org_settings.default_provider` và `enabled_providers[]` theo tenant

### I-303 · [M] Trang event công khai (Next.js)
- `/e/[slug]` — landing event server-rendered (SEO)
- `/e/[slug]/register` — form (tên, email, loại vé, số lượng)
- `/e/[slug]/register/pay` — provider selector → redirect tới checkout
- `/e/[slug]/register/success` — xác nhận, hiện order id
- `/ticket/[regId]` — hiện QR cho attendee (yêu cầu OTP gate qua email)

### I-304 · [M] Worker sinh QR
- BullMQ queue: `qr:generate`
- Trigger bởi domain event `TicketIssued`
- Dùng lib `qrcode` npm render PNG/SVG
- Upload lên S3 / MinIO
- Lưu URL vào `registrations.qr_image_url`
- Ed25519 signing key theo tenant load từ `/etc/api-gateway/keys/`

### I-305 · [M] Gửi email
- `EmailNotifier` (Notification context) + `ResendAdapter`
- Twig template: `ticket-confirmation`, `payment-receipt`, `event-reminder`
- BullMQ queue: `email:send`
- Retry 3 lần, rồi dead-letter
- Xử lý bounce/complaint qua webhook Resend

### I-306 · [M] Test
- Unit: pricing rule, áp discount, ký QR
- Integration: verify chữ ký webhook cho cả 2 provider
- E2E (Playwright): register → pay (Stripe test mode) → nhận email → thấy QR

---

## Definition of Done

- [ ] Công chúng có thể đăng ký event đã publish mà không cần auth
- [ ] Thanh toán test Stripe hoàn tất → event `OrderPaid` → issue vé → gửi email
- [ ] IPN VNPay sandbox → issue vé
- [ ] Webhook trùng lặp không tính tiền 2 lần
- [ ] Attendee có thể xem QR tại `/ticket/[regId]` (OTP gate)
- [ ] Mọi test Phase 3 xanh trên CI
