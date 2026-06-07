# Tenant outbound webhooks (I-901)

> **Phase 9 — Platform Maturity.** Tenant đăng ký HTTP endpoint để nhận event payloads.
> BFF ký HMAC-SHA256 trên body, BullMQ retry 5 lần, audit log + delivery log.

## Event types

| Type | Khi nào emit | Payload shape |
|------|--------------|---------------|
| `event.published` | Event chuyển từ draft → published | `{ eventId, slug, name, startsAt, venueId }` |
| `event.updated` | Bất kỳ field nào của event thay đổi | `{ eventId, changes: [...] }` |
| `event.cancelled` | Event bị cancel | `{ eventId, cancelledAt, reason? }` |
| `order.created` | Order được tạo (chưa thanh toán) | `{ orderId, eventId, ticketTypeId, totalCents, currency }` |
| `order.paid` | PaymentIntent succeed / IPN ok | `{ orderId, eventId, paidAt, provider, providerEventId }` |
| `order.refunded` | Refund processed | `{ orderId, refundId, amountCents, reason? }` |
| `registration.created` | Attendee row insert | `{ registrationId, orderId, eventId, attendeeEmail }` |
| `registration.checked_in` | Staff scan QR thành công | `{ registrationId, eventId, scannedAt, staffId }` |
| `registration.no_show` | Event kết thúc + attendee chưa check-in | `{ registrationId, eventId, eventEndedAt }` |
| `*` | Wildcard — nhận tất cả events | (same as above) |

## Headers

Mọi request BFF gửi đi:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Type` | `application/json` | |
| `User-Agent` | `SaasCheckin-Webhooks/1.0` | |
| `X-Signature-SHA256` | `sha256=<hex>` | HMAC-SHA256(secret, `${timestamp}.${rawBody}`) |
| `X-Webhook-Timestamp` | `<unix-seconds>` | Replay protection (default 5 min skew) |
| `X-Webhook-Id` | `<delivery-id>` | Idempotency key — dedup ở consumer |
| `X-Webhook-Event` | `<event-type>` | Routing hint (also in body) |

## Body

```json
{
  "id": "wh_dlv_mq3i25gk_1",
  "type": "event.published",
  "created_at": "2026-06-07T15:00:00.000Z",
  "data": { /* event-specific payload */ }
}
```

## Verify (Node.js)

```js
const crypto = require("node:crypto");

function verify(req, secret) {
  const ts = req.headers["x-webhook-timestamp"];
  const sig = req.headers["x-signature-sha256"]; // "sha256=..."
  const skew = Math.abs(Date.now() / 1000 - Number(ts));
  if (skew > 300) throw new Error("expired");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${req.rawBody}`) // rawBody = unparsed JSON string
    .digest("hex");
  const got = sig.replace("sha256=", "");
  if (expected.length !== got.length) throw new Error("mismatch");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got))) {
    throw new Error("mismatch");
  }
}
```

## Retry policy

- **5 attempts**, exponential backoff: 5s → 25s → 125s → 625s → 3125s
- **HTTP 2xx** → delivered (success)
- **HTTP 408, 429, 5xx** + **network error** → retry
- **HTTP 4xx (other)** → permanent fail (don't retry — bad payload)
- Sau 5 attempts → rơi vào `webhook_delivery_dlx` (DLQ retention 7 ngày, replay qua `POST /v1/webhooks/deliveries/:id/replay`)

## Plan quota

| Plan | Max subscriptions | Max event types / sub | Wildcard `*` |
|------|-------------------|------------------------|---------------|
| Free | 1 | 1 | ✅ |
| Pro | 5 | 10 | ✅ |
| Enterprise | 100 | 50 | ✅ |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/webhooks` | List subscriptions của tenant |
| `POST` | `/v1/webhooks` | Tạo subscription — trả `{ subscription, secret }` (secret chỉ hiện 1 lần) |
| `PATCH` | `/v1/webhooks/:id` | Update url/events/active/description |
| `DELETE` | `/v1/webhooks/:id` | Xóa subscription |
| `POST` | `/v1/webhooks/:id/test` | Gửi test event sync, trả HTTP status + body |
| `GET` | `/v1/webhooks/deliveries?limit=50` | Recent delivery log |
| `POST` | `/v1/webhooks/deliveries/:id/replay` | Re-enqueue failed delivery |

## Security

- **Secret storage**: AES-256-GCM encrypted at rest (key từ `WEBHOOK_ENCRYPTION_KEY` env, fallback `JWT_SIGNING_KEY`).
- **Secret reveal**: chỉ trong response của `POST /v1/webhooks`. Sau đó không query được nữa.
- **URL allowlist**: chỉ `http://` / `https://`. Block `javascript:`, `file:`, `data:`.
- **Per-tenant isolation**: subscription store filter theo `tenantId` từ JWT — không có cross-tenant access.
- **Audit log**: mỗi create/update/delete ghi vào `platform_audit_log` qua AuditModule (Phase 6).

## Architecture

```
[Event source (core-api outbox / BFF direct)]
        │
        ▼
WebhookService.dispatchEvent(tenantId, eventType, payload)
        │
        ├─ list subs (active + match eventType)
        │
        └─ for each sub:
              ├─ recordDelivery (in-memory store)
              └─ deliveryQueue.add("deliver", { deliveryId })
                                                  │
                                                  ▼
                          WebhookDeliveryProcessor (BullMQ worker)
                                                  │
                                                  ├─ decrypt secret
                                                  ├─ sign HMAC
                                                  ├─ POST → URL
                                                  └─ updateDelivery status
                                                  │
                       5xx/429/network ─── throw ──► retry
                                                  │
                                                  └─ exhausted (5) ──► DLQ
```

## Future (Phase 10+)

- Replace `InMemoryWebhookStore` với `PostgresWebhookStore` (table `webhook_subscriptions`, `webhook_deliveries`). Interface `IWebhookStore` đã stable, chỉ swap implementation.
- Outbox relay ở `apps/core-api`: `OutboxRelayService` poll `outbox_messages` → publish qua MassTransit → BFF subscribe → `WebhookService.dispatchEvent`. Hiện tại Phase 9 BFF gọi trực tiếp `dispatchEvent` từ các điểm nghiệp vụ (order.paid, registration.checked_in, etc).
- Multi-region: subscription row ở region `eu`/`sg` — route webhook delivery qua region của tenant (cross-reference I-902).
