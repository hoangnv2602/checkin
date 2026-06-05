# 04 · Bounded Context (DDD)

DDD chiến lược + tactical theo Vernon / Evans.

## Context Map

```
                    ┌──────────────────────┐
                    │ Identity & Tenancy  │ ◀─── Customer/Supplier (upstream)
                    └──────────┬───────────┘
                               │ publishes: UserRegistered, OrgCreated
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌────────────────┐      ┌──────────────┐
│  Billing      │      │Event Management│      │ Notification │
└──────┬────────┘      └────────┬───────┘      └──────────────┘
       │ SubscriptionActivated  │ EventPublished
       └──────────┐             │
                  ▼             ▼
            ┌────────────────────────┐
            │ Registration & Ticket  │
            └──────────┬─────────────┘
                       │ TicketIssued, RegistrationConfirmed
                       ▼
            ┌────────────────────────┐
            │       Check-in         │ ◀── Conformist (downstream)
            └────────────────────────┘
```

## Chi tiết từng context

### A. Identity & Tenancy (Upstream — Core)

- **Aggregate:** `User`, `Organization` (AggregateRoot), `Membership`
- **Value Object:** `Email`, `OrgSlug`, `Role`
- **Domain Service:** `PasswordHasher`, `JwtSigner`
- **Event:** `OrgCreated`, `UserInvited`, `RoleChanged`

### B. Event Management

- **Aggregate:** `Event` (root), `Session`, `Venue`
- **Value Object:** `EventPeriod`, `Capacity`, `GeoLocation`
- **Invariant:**
  - `capacity > 0`
  - `startAt < endAt`
  - Event đã publish không được giảm `capacity` xuống dưới `soldTickets`
- **Event:** `EventPublished`, `EventCancelled`, `SessionRescheduled`

### C. Registration & Ticketing

- **Aggregate:** `TicketType` (root), `Order`, `Registration`
- **Value Object:** `Money`, `DiscountCode`, `QrSignature`
- **Domain Service:** `PricingService`, `QrCodeGenerator` (ký Ed25519)
- **Use Case:** `RegisterAttendee`, `IssueTicket`, `ApplyDiscount`
- **Event:** `TicketIssued`, `TicketRevoked`, `OrderPaid`

### D. Check-in (Core)

- **Aggregate:** `CheckInRecord` (root)
- **Value Object:** `QrPayload`, `GateId`, `CheckInStatus` (`CheckedIn` | `Rejected` | `Duplicate`)
- **Invariant:**
  - Một `Registration` có nhiều nhất một `CheckInRecord` với `status = success`
  - `gateId` phải thuộc `event.venueId`
  - Chữ ký QR phải verify được bằng public key hiện tại (cửa sổ xoay)
- **Use Case:** `ScanQr`, `ManualCheckIn`, `UndoCheckIn` (chỉ Owner)
- **Event:** `AttendeeCheckedIn`, `CheckInRejected`, `SuspiciousDuplicate`

### E. Billing

- **Aggregate:** `Subscription`, `Invoice`
- **Tích hợp:** Stripe Webhook + VNPay IPN → aggregate `Subscription`
- **Plan limit được enforce:** số event active, attendee / tháng, staff seat

### F. Notification

- **Conformist** — consume event từ context khác
- **Kênh:** Email (Resend), SMS (Twilio), Push (FCM)
- Template lưu theo tenant

## Pattern tactical

| Pattern | Áp dụng ở đâu |
|---------|---------------|
| Aggregate Root | Mọi aggregate ở trên |
| Value Object | Mọi thuộc tính bất biến (`Money`, `Email`, `QrPayload`) |
| Domain Event | Publish qua `IDomainEvent` (in-process MediatR) + `IIntegrationEvent` (MassTransit + RabbitMQ) |
| Repository | Chỉ load/save Aggregate Root. Code domain không biết về EF Core. |
| Application Service | 1 use case = 1 command handler |
| Specification | `CanCheckInSpecification`, `EventIsPublishableSpecification` |
| Outbox | Event ghi vào `outbox_messages` trong cùng transaction DB; `OutboxRelayService` (IHostedService) poll và publish qua MassTransit |

## Cross-cutting context — Platform Operations (cho checkin-admin)

Ngoài 6 bounded context trên, các use case **cross-tenant** (list all tenants, suspend, refund, audit, impersonate) không thuộc context nào phía trên. Hai cách tiếp cận đã cân nhắc:

| Cách | Ưu | Nhược |
|---|---|---|
| **Context mới `PlatformOperations`** trong `SaasCheckin.Domain/PlatformOperations/` | Rõ ownership, rõ aggregate, dễ test | Phải duy trì 1 context mới |
| Mở rộng `Identity` (thêm `PlatformOwner` aggregate) | Tránh thêm folder | Identity context phình to, lẫn concern tenant + platform |

**Chốt (xem ADR-0014):** tạo context mới `PlatformOperations` với 3 aggregate:

- **`PlatformUser`** (AggregateRoot<Guid>) — root user cho audience checkin-admin. KHÔNG có `tenant_id`. Lưu `email`, `password_hash`, `role` ∈ {`platform_owner`, `platform_support`, `platform_engineer`}, `mfa_secret` (TOTP), `mfa_enabled`, `last_login_at`, `failed_login_count`, `locked_until`. Reset password KHÔNG dùng email magic link như tenant; chỉ Owner-platform reset trực tiếp + bắt buộc MFA re-enroll.
- **`PlatformSession`** (AggregateRoot<Guid>) — session token (opaque, 30 phút, xoay mỗi request), refresh token (8 giờ, single-use), IP + user agent binding.
- **`PlatformAuditEntry`** (AggregateRoot<Guid>) — append-only, ghi mỗi mutation từ checkin-admin. Trường: `actor_platform_user_id`, `target_tenant_id?`, `target_entity?`, `action` (vd `tenant.suspend`, `subscription.refund`, `user.impersonate`), `request_payload_jsonb`, `response_payload_jsonb?`, `ip`, `user_agent`, `at`. Bảng này **không bao giờ UPDATE / DELETE** — chỉ SELECT. RLS vẫn bật cho `app_platform_owner` trên table này (chỉ select được, không xoá được).

Khi nào thêm: Phase 0-1 chỉ cần `PlatformUser` + `PlatformSession` (auth); Phase 5-6 thêm `PlatformAuditEntry` (cho compliance). Trước khi có `PlatformAuditEntry`, mọi checkin-admin mutation ghi log vào `outbox_messages` với topic `platform.audit.<action>` để có audit trail tạm thời.

## Anti-pattern cần tránh

- ❌ Inject `DbContext` hoặc `IRepository<>` vào constructor aggregate
- ❌ Public setter trên entity (dùng method hành vi như `Cancel()`, `Reschedule()`)
- ❌ Với tay sang context khác từ aggregate này sang aggregate khác (dùng ID + repository, hoặc integration event)
- ❌ Anemic domain model (logic nằm ở controller/service, entity chỉ là data bag)
- ❌ Lazy loading quan hệ bên trong aggregate (gây N+1 + coupling DB)
- ❌ **`PlatformOperations` aggregate sờ vào `Identity` / `Billing` aggregate trực tiếp** — phải đi qua `IIntegrationEventBus` hoặc query read-only với ID. Sờ trực tiếp dễ bypass audit log.

## Shared kernel

Nằm ở `apps/core-api/shared/Shared.*` (xem chi tiết trong [`docs/api/structure.md`](./api/structure.md) và [`docs/api/building-blocks.md`](./api/building-blocks.md)):
- `Shared.Domain/` — `AggregateRoot<TKey>`, `Entity<TKey>`, `ValueObject` (record), `IDomainEvent`, `IDomainEventHandler<T>`, `IMultiTenant`, `ICurrentTenant`, `ITenantResolver`, audit interfaces, `Specification<T>`
- `Shared.Domain.Core/` — `Result<T>`, `Guard`, `BusinessRuleViolationException`, `IClock` + `SystemClock`, `Money` base
- `Shared.Application/` — `IUnitOfWork`, `IRepository<T, TKey>`, `IIntegrationEventBus`, MediatR pipeline behaviors
- `Shared.Application.Contracts/` — `IApplicationService`, `IQueryService<T>`, `ICrudAppService`, DTOs (`PagedResultDto<T>`, `PagedAndSortedResultRequestDto`), `ICurrentUser`, `IPermissionChecker`
- `Shared.EntityFrameworkCore/` — `DbContextBase`, `EfRepository<T, TKey>`, `EfUnitOfWork`, `TenantDbConnectionInterceptor`, `AuditableEntitySaveChangesInterceptor`, value converter cho `ValueObject`
- `Utility/` — `Slugify`, `JsonConverters`, `IdempotencyKeyGenerator`, `SerilogTenantEnricher`, `PollyResiliencePipelineFactory`, `OpenTelemetryExtensions`

Bất cứ thứ gì không fit vào đây thì **không** shared — duplicate nó.
