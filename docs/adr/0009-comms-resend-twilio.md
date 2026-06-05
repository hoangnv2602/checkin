# 0009. Truyền thông: Resend (email) + Twilio (SMS)

- **Status:** Accepted (D8)
- **Date:** 2026-06-04

## Context

Nền tảng cần gửi:
- **Email giao dịch:** xác nhận vé, reset password, hóa đơn, cảnh báo cho organizer
- **SMS:** OTP cho login, nhắc nhở event phút chót (carrier VN)
- (Tương lai) **Push notification** tới mobile — xử lý bằng FCM trong `apps/mobile`, không thuộc ADR này

## Decision

Dùng **Resend** cho email và **Twilio** cho SMS, cả hai sau `IEmailSender` / `ISmsSender` trong bounded context Notification của core-api (.NET Core 10).

```ts
interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailResult>;
}
interface SmsProvider {
  send(msg: SmsMessage): Promise<SmsResult>;
}
```

- `ResendAdapter` — dùng Resend SDK; HTML + plain text + attachment
- `TwilioAdapter` — dùng Twilio SDK; sender ID đăng ký trước ở VN
- Template nằm trong `apps/core-api/src/SaasCheckin.Application/Notification/Templates/` (Scriban — biến `{{name}}`, `{{event_title}}`...), cho phép override theo tenant qua bảng `notification_templates(tenant_id, channel, name, subject, body)`
- Mọi lần gửi qua **MassTransit consumer** (`IIntegrationEventHandler<TEvent>`) trong `Notification` context; retry cấu hình `Retry.Exponential(5, ...)`; dead-letter queue `_error` sau khi hết retry

## Consequences

### Positive
- Cả hai provider có free / low tier hào phóng ở volume MVP.
- DX của Resend best-in-class cho transactional email; độ phủ SMS Twilio cho carrier VN rộng nhất.
- Interface adapter nghĩa là có thể swap sang SendGrid / Mailgun / MessageBird mà không đụng code domain.

### Negative
- Resend tương đối trẻ; một số tính năng nâng cao (vd dedicated IP) đắt hơn SendGrid.
- Twilio SMS sang VN ~$0.0085/SMS; không free khi scale. Theo dõi usage / tenant.

### Neutral
- Xử lý bounce / complaint qua webhook Resend; link unsubscribe trong mọi email.
- SMS opt-in / opt-out track theo user để tuân thủ.

## Alternatives considered

- **AWS SES** — rẻ, nhưng DX thô; cần SNS cho bounce.
- **SendGrid** — trưởng thành, nhưng pricing tier xấu hơn Resend ở volume mình.
- **Mailgun** — ổn, không có lợi thế thuyết phục.
- **Provider SMS VN (vd eSMS.vn, SpeedSMS)** — rẻ hơn cho volume VN-only, nhưng Twilio single API dễ maintain hơn. Đánh giá lại nếu chi phí SMS > $200/tháng.

## Revisit if

- Volume email > 100k/tháng → đánh giá pricing SES vs Resend.
- Thêm push notification → provider mới trong cùng interface.
- Vấn đề open-rate / deliverability → audit SPF/DKIM/DMARC + sender reputation.
