# 0005. Payment provider: Stripe + VNPay

- **Status:** Accepted (D4)
- **Date:** 2026-06-04

## Context

Thị trường mục tiêu chủ yếu Việt Nam nhưng cũng có organizer quốc tế. Hai nhu cầu thanh toán chính:
- **Quốc tế:** Stripe là lựa chọn hiển nhiên (thẻ, Apple Pay, Google Pay, subscription, webhook trưởng thành).
- **Việt Nam:** Stripe về mặt kỹ thuật dùng được cho doanh nghiệp đăng ký ở VN, nhưng adoption thấp. **VNPay** + **MoMo** + **ZaloPay** thống trị checkout online nội địa. Để maximize conversion cho event VN, phải hỗ trợ ít nhất VNPay.

Xây flow checkout 2 lần sẽ duplicate business logic (order state, refund, reconciliation) và tạo drift.

## Decision

Định nghĩa **`PaymentProviderInterface`** trong module billing của `api-gateway`:

```ts
interface PaymentProvider {
  readonly name: 'stripe' | 'vnpay';
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(headers, body): Promise<WebhookEvent>;
  cancelOrder(orderId: string): Promise<void>;
  refund(paymentId: string, amount: Money): Promise<RefundResult>;
}
```

Implement hai adapter:
- **`StripeAdapter`** — dùng Stripe SDK; `PaymentIntent` cho one-time, `Subscription` cho plan. Verify chữ ký webhook qua `stripe.webhooks.constructEvent`.
- **`VnpayAdapter`** — dùng VNPay REST API; build redirect URL với `vnp_SecureHash` (HMAC-SHA512); verify chữ ký IPN trước khi xử lý.

Cả hai adapter ghi vào cùng bảng `payments` với enum `provider` + `provider_event_id` (idempotency). Một `WebhookRouter` duy nhất dispatch theo path URL hoặc header signature. Một `PaymentFailedWorker` poll các order `pending` > 10 phút (IPN VNPay đôi lúc trễ).

`org_settings` của mỗi tenant ghi:
- `default_provider` (dùng khi checkout trừ khi khách chọn)
- `enabled_providers` (array)

## Consequences

### Positive
- Use case ở layer domain phụ thuộc interface, không phụ thuộc SDK provider nào. Swap vendor là việc 1 tuần.
- Idempotency ở cấp DB: `UNIQUE (provider, provider_event_id)` ngăn double-charge khi webhook retry.
- Provider mới (MoMo, ZaloPay) chỉ 1 file + 1 dòng trong enum.

### Negative
- Implementation adapter phải xử lý quirk riêng của provider (VNPay yêu cầu param URL-encoded theo thứ tự cụ thể, Stripe muốn raw body để verify webhook).
- Developer experience của VNPay thua Stripe nhiều năm. Kỳ vọng nhiều vòng fix bug hơn.

### Neutral
- Refund cho VNPay cần gọi API `dr` (refund) riêng — xử lý bên trong adapter.
- Báo cáo / dashboard phải aggregate chéo provider; chuẩn hoá trên bảng `payments`.

## Alternatives considered

- **Chỉ Stripe** — giết conversion VN.
- **Chỉ VNPay** — giết conversion quốc tế.
- **PayOS / MoMo / ZaloPay thay VNPay** — VNPay có lượng merchant VN lớn nhất theo volume. Thêm các cái khái làm adapter ở Phase 8 nếu được yêu cầu.
- **Aggregator (vd 2C2P, OnePay)** — thêm phí và thêm lớp; không đáng ở MVP.

## Revisit if

- > 5% doanh thu từ provider mới → thêm adapter.
- Vấn đề độ tin cậy IPN VNPay vẫn còn → xây dedicated polling worker.
