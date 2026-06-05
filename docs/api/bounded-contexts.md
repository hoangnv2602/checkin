# Bounded Contexts · Module hóa trong SaasCheckin

6 bounded context (Identity, EventManagement, Registration, CheckIn, Billing, Notification) được tổ chức thành **module** trong 1 monolith-modular. Tài liệu này giải thích cách wire-up từng context, dependency giữa các context, và pattern giao tiếp.

> **Nguyên tắc cốt lõi:** Context chỉ giao tiếp qua **IIntegrationEventBus** (MassTransit) hoặc **domain event** (MediatR in-process). KHÔNG trực tiếp reference aggregate/aggregate root của context khác. Nếu cần data từ context khác, consume event và maintain read-model local.

---

## 1. Module layout cho mỗi context

Mỗi context có cùng layout qua 3 project:

```
SaasCheckin.Domain/<Context>/
├── <Context>Module.cs                # IModule implementation
├── Aggregates/                       # root entities
│   ├── <Aggregate>.cs
│   └── ...
├── ValueObjects/
├── Events/                           # domain events (in-process) + integration events (cross-service)
│   ├── <Event>DomainEvent.cs
│   └── <Event>IntegrationEvent.cs
├── Exceptions/                       # context-specific exceptions
├── Repositories/                     # IRepository<> interfaces
└── Services/                         # domain services (hiếm, khi logic span nhiều aggregate)

SaasCheckin.Application/<Context>/
├── <Entity>AppService.cs             # use case implementation
├── Validators/                       # FluentValidation
├── Mapping/                          # Mapster profile
└── EventHandlers/                    # MediatR local + MassTransit consumer

SaasCheckin.EntityFrameworkCore/Configurations/<Context>/
└── <Aggregate>Configuration.cs       # IEntityTypeConfiguration<>

SaasCheckin.Application.Contracts/<Context>/
├── I<Entity>AppService.cs            # public interface
├── Dtos/                             # CreateInput, UpdateInput, <Entity>Dto
└── Permissions/                      # <Context>Permissions constants
```

---

## 2. 6 Module SaasCheckin

### 2.1 IdentityModule

**Trách nhiệm:** User, Organization, Membership, Role, invitation flow.

```csharp
// src/SaasCheckin.Domain/Identity/IdentityModule.cs
public class IdentityModule : ModuleBase
{
    public override string Name => "Identity";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IMembershipRepository, MembershipRepository>();
        services.AddTransient<IUserAppService, UserAppService>();
        services.AddTransient<IOrganizationAppService, OrganizationAppService>();
        services.AddTransient<IPasswordHasher, BcryptPasswordHasher>();
        services.AddTransient<IJwtTokenService, JwtTokenService>();
        // Local event handlers
        services.AddTransient<OrganizationCreatedHandler>();
        services.AddTransient<UserInvitedHandler>();
    }
}
```

**Aggregates:**

| Aggregate | Root | VOs | Events |
|---|---|---|---|
| `User` | ✓ | `Email`, `PasswordHash`, `DisplayName` | `UserRegistered`, `UserInvited`, `PasswordChanged` |
| `Organization` | ✓ | `OrgSlug`, `PlanTier`, `TenantId` | `OrgCreated`, `PlanChanged` |
| `Membership` | ✓ | `Role` (Owner/Admin/Staff/Viewer) | `MemberJoined`, `RoleChanged`, `MemberRemoved` |

**Permissions:** `IdentityPermissions.Users.Invite`, `IdentityPermissions.Orgs.ManageBilling`, ...

**gRPC service:** `IdentityGrpcService` (SignInUser, RefreshUser, GetUser — gọi từ api-gateway NestJS)

---

### 2.2 EventManagementModule

**Trách nhiệm:** Event, Session, Venue, publish/cancel workflow.

```csharp
// src/SaasCheckin.Domain/EventManagement/EventManagementModule.cs
public class EventManagementModule : ModuleBase
{
    public override string Name => "EventManagement";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<ISessionRepository, SessionRepository>();
        services.AddScoped<IVenueRepository, VenueRepository>();
        services.AddTransient<IEventAppService, EventAppService>();
        services.AddTransient<IVenueAppService, VenueAppService>();
        // Integration event handlers (từ context khác)
        services.AddTransient<OrganizationPlanChangedHandler>(); // → invalidate cache
        services.AddTransient<RegistrationCancelledHandler>();   // → release capacity
    }
}
```

**Aggregates:**

| Aggregate | VOs | Domain Events | Integration Events (publish) |
|---|---|---|---|
| `Event` | `EventPeriod`, `Capacity`, `Status` (Draft/Published/Cancelled/Completed) | `EventCreated`, `EventPublished`, `EventCancelled` | `EventPublishedIntegrationEvent`, `EventCancelledIntegrationEvent` |
| `Session` | `SessionTime`, `Track` | `SessionRescheduled` | — |
| `Venue` | `GeoLocation`, `Address` | — | — |

**State machine (Stateless library):**
```csharp
public class Event : FullAuditedAggregateRoot<Guid>, IMultiTenant
{
    public EventStatus Status { get; private set; }
    private StateMachine<EventStatus, EventTrigger> _machine;

    public void ConfigureStateMachine()
    {
        _machine = new StateMachine<EventStatus, EventTrigger>(() => Status);
        _machine.Configure(EventStatus.Draft)
            .Permit(EventTrigger.Publish, EventStatus.Published);
        _machine.Configure(EventStatus.Published)
            .Permit(EventTrigger.Cancel, EventStatus.Cancelled)
            .Permit(EventTrigger.Complete, EventStatus.Completed);
        _machine.Configure(EventStatus.Cancelled)
            .Permit(EventTrigger.Reopen, EventStatus.Draft);
    }

    public void Publish()
    {
        _machine.Fire(EventTrigger.Publish);
        AddDomainEvent(new EventPublishedDomainEvent(Id, TenantId, Title));
        AddIntegrationEvent(new EventPublishedIntegrationEvent(Id, TenantId!.Value, Title, StartAt));
    }
}
```

---

### 2.3 RegistrationModule

**Trách nhiệm:** TicketType, Order, Registration, payment flow coordination, QR issuance.

```csharp
public class RegistrationModule : ModuleBase
{
    public override string Name => "Registration";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ITicketTypeRepository, TicketTypeRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IRegistrationRepository, RegistrationRepository>();
        services.AddTransient<ITicketTypeAppService, TicketTypeAppService>();
        services.AddTransient<IRegistrationAppService, RegistrationAppService>();
        services.AddTransient<IOrderAppService, OrderAppService>();
        services.AddTransient<IPricingService, PricingService>();
        services.AddTransient<IQrCodeGenerator, Ed25519QrCodeGenerator>();
        services.AddTransient<RegisterAttendeeHandler>();
        services.AddTransient<OrderPaidHandler>(); // local event → issue ticket
    }
}
```

**Aggregates:**

| Aggregate | VOs | Events |
|---|---|---|
| `TicketType` | `Money` (price), `Capacity`, `SalesWindow` | `TicketTypeCreated`, `SalesEnded` |
| `Order` | `Money`, `OrderStatus` (Pending/Paid/Failed/Refunded), `DiscountCode` | `OrderCreated`, `OrderPaid`, `OrderFailed` |
| `Registration` | `QrPayload`, `QrSignature` (Ed25519), `AttendeeInfo` | `TicketIssued`, `TicketRevoked` |

**Integration events (publish):**
- `TicketIssuedIntegrationEvent` → CheckIn consume (warm cache)
- `TicketRevokedIntegrationEvent` → CheckIn consume (invalidate)

**Integration events (subscribe):**
- `EventPublishedIntegrationEvent` (từ EventManagement) → mở bán ticket
- `OrderPaidIntegrationEvent` (từ Billing) → issue ticket

---

### 2.4 CheckInModule

**Trách nhiệm:** QR scan, manual check-in, undo, real-time stats. **High-throughput, scale-out dễ.**

```csharp
public class CheckInModule : ModuleBase
{
    public override string Name => "CheckIn";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ICheckInRecordRepository, CheckInRecordRepository>();
        services.AddScoped<IGateRepository, GateRepository>();
        services.AddTransient<ICheckInAppService, CheckInAppService>();
        services.AddTransient<IGateAppService, GateAppService>();
        services.AddTransient<IQrSignatureVerifier, Ed25519QrSignatureVerifier>();
        services.AddTransient<ScanQrHandler>();
        services.AddTransient<ManualCheckInHandler>();
        // Cache hot path
        services.AddSingleton<ICheckInCache, RedisCheckInCache>();
    }
}
```

**Aggregates:**

| Aggregate | VOs | Invariants |
|---|---|---|
| `CheckInRecord` | `QrPayload`, `GateId`, `CheckInStatus` (Success/Rejected/Duplicate), `DeviceMeta` | Một `Registration` tối đa 1 `CheckInRecord` với `status = Success` (partial unique index) |

**Partial unique index (EF Core migration):**
```csharp
// src/SaasCheckin.EntityFrameworkCore/Configurations/CheckInRecordConfiguration.cs
public class CheckInRecordConfiguration : IEntityTypeConfiguration<CheckInRecord>
{
    public void Configure(EntityTypeBuilder<CheckInRecord> b)
    {
        b.ToTable("check_in_records", t => t.HasComment("Audit log of every scan attempt"));
        b.HasKey(x => x.Id);

        b.Property(x => x.TenantId).IsRequired();
        b.Property(x => x.RegistrationId).IsRequired();
        b.Property(x => x.GateId).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.ScannedAt).IsRequired();

        b.HasIndex(x => new { x.TenantId, x.RegistrationId })
            .HasFilter("status = 'Success'")  // ← partial unique
            .IsUnique()
            .HasDatabaseName("ix_check_in_records_one_success_per_registration");

        b.HasIndex(x => new { x.TenantId, x.EventId, x.ScannedAt });
    }
}
```

**gRPC service:** `CheckInGrpcService` (`Scan`, `UndoCheckIn`, `ListCheckIns`, `GetEventStats`) — main gRPC surface từ api-gateway.

**Cache layer:** `ICheckInCache` (Redis) lưu:
- `event:{eventId}:checkin_count` (counter atomic)
- `reg:{regId}:status` (đã check-in hay chưa, giảm query DB)
- TTL 5 phút; invalidate khi `CheckInRecord` insert.

---

### 2.5 BillingModule

**Trách nhiệm:** Subscription, Invoice, Plan, payment provider abstraction, plan limit enforcement.

```csharp
public class BillingModule : ModuleBase
{
    public override string Name => "Billing";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ISubscriptionRepository, SubscriptionRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IPlanRepository, PlanRepository>();
        services.AddTransient<ISubscriptionAppService, SubscriptionAppService>();
        services.AddTransient<IInvoiceAppService, InvoiceAppService>();
        services.AddTransient<IPlanLimitEnforcer, PlanLimitEnforcer>();
        // Payment providers
        services.AddTransient<IPaymentProvider, StripePaymentAdapter>();
        services.AddTransient<IPaymentProvider, VnpayPaymentAdapter>();
        services.AddTransient<IPaymentProviderResolver, PaymentProviderResolver>();
        // Webhook handlers
        services.AddTransient<StripeWebhookHandler>();
        services.AddTransient<VnpayWebhookHandler>();
    }
}
```

**Aggregates:**

| Aggregate | VOs | Events |
|---|---|---|
| `Subscription` | `PlanTier` (Free/Pro/Enterprise), `BillingPeriod` (Monthly/Yearly), `SubscriptionStatus` | `SubscriptionActivated`, `SubscriptionCancelled`, `PlanLimitExceeded` |
| `Invoice` | `Money`, `LineItem[]`, `Status` (Pending/Paid/Refunded) | `InvoiceIssued`, `InvoicePaid` |
| `Plan` | `Limits` (MaxEvents, MaxAttendeesPerMonth, MaxStaffSeats), `Price` | `PlanChanged` |

**Plan limit enforcement (middleware):**
```csharp
// apps/api-gateway/src/common/guards/plan-limit.guard.ts (BFF side) — pre-check
// SaasCheckin.Infrastructure/Billing/PlanLimitEnforcer.cs (defense-in-depth)
public class PlanLimitEnforcer
{
    public async Task EnsureCanCreateEventAsync(Guid tenantId, CancellationToken ct)
    {
        var subscription = await _subscriptionRepository.GetActiveAsync(tenantId, ct);
        var currentUsage = await _eventRepository.GetActiveCountAsync(tenantId, ct);
        if (currentUsage >= subscription.Plan.MaxActiveEvents)
            throw new PlanLimitExceededException("MaxActiveEvents", currentUsage, subscription.Plan.MaxActiveEvents);
    }
}
```

**PaymentProviderResolver:** chọn adapter dựa trên `org_settings.default_provider` và `enabled_providers[]`. Webhook controller dispatch theo URL: `/api/billing/webhook/{provider}`.

---

### 2.6 NotificationModule

**Trách nhiệm:** Gửi email/SMS/push. **Conformist — chỉ consume event, không có aggregate riêng.**

```csharp
public class NotificationModule : ModuleBase
{
    public override string Name => "Notification";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        // Channel adapters
        services.AddTransient<IEmailSender, ResendEmailSender>();
        services.AddTransient<ISmsSender, TwilioSmsSender>();
        services.AddTransient<IPushSender, FcmPushSender>();
        // Renderers
        services.AddTransient<ITemplateRenderer, ScribanTemplateRenderer>();
        // Integration event consumers (MassTransit)
        services.AddTransient<OrderPaidEmailHandler>();
        services.AddTransient<TicketIssuedEmailHandler>();
        services.AddTransient<EventReminderEmailHandler>();
        services.AddTransient<CheckInDuplicateAlertSmsHandler>();
    }
}
```

**Không có aggregate root.** Templates lưu theo tenant: `notification_templates(tenant_id, channel, name, subject, body_scriban)`.

**MassTransit consumer example:**
```csharp
// src/SaasCheckin.Application/Notification/Consumers/TicketIssuedEmailHandler.cs
public class TicketIssuedEmailHandler : IConsumer<TicketIssuedIntegrationEvent>
{
    public async Task Consume(ConsumeContext<TicketIssuedIntegrationEvent> context)
    {
        var @event = context.Message;
        var template = await _templateRepo.GetAsync(@event.TenantId, "ticket-issued", context.CancellationToken);
        var body = _renderer.Render(template, @event);
        await _emailSender.SendAsync(new EmailMessage(@event.AttendeeEmail, template.Subject, body), context.CancellationToken);
    }
}
```

**Retry:** MassTransit cấu hình `Retry.Immediate(3)` + `Retry.Exponential(5, TimeSpan.FromSeconds(2), TimeSpan.FromMinutes(10), TimeSpan.FromSeconds(30))` → sau cùng → `_error` queue.

---

## 3. SaasCheckinHostModule (load tất cả)

```csharp
// src/SaasCheckin.Domain/Modules/SaasCheckinHostModule.cs
public class SaasCheckinHostModule : ModuleBase
{
    public override string Name => "SaasCheckin.Host";

    public SaasCheckinHostModule(IEnumerable<IModule> modules)
    {
        // Không có logic; chỉ để wire-up trong Program.cs
    }

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        // Cross-cutting wiring
        services.AddDbContext<SaasCheckinDbContext>(opts =>
        {
            opts.UseNpgsql(configuration.GetConnectionString("Default"));
            opts.AddInterceptors(new TenantDbConnectionInterceptor(/*...*/));
            opts.AddInterceptors(new AuditableEntitySaveChangesInterceptor(/*...*/));
        });

        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped(typeof(IRepository<,>), typeof(EfRepository<,>));

        // MediatR
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(SaasCheckinHostModule).Assembly);
            cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
            cfg.AddOpenBehavior(typeof(UnitOfWorkBehavior<,>));
            cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
            cfg.AddOpenBehavior(typeof(MultiTenantBehavior<,>));
        });

        // MassTransit
        services.AddMassTransit(x =>
        {
            x.AddConsumers(typeof(SaasCheckinHostModule).Assembly);
            x.UsingRabbitMq((ctx, cfg) =>
            {
                cfg.Host(configuration["RabbitMq:Host"]);
                cfg.ConfigureEndpoints(ctx);
            });
        });

        // gRPC
        services.AddGrpc();
        services.AddGrpcReflection();

        // OpenAPI
        services.AddEndpointsApiExplorer();
        services.AddOpenApi();   // .NET 9+ built-in
        services.AddScalar();

        // Auth
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(opts => /* configure RS256 */);
        services.AddAuthorization();

        // CORS, multi-tenant resolver
        services.AddCors();
        services.AddHttpContextAccessor();
        services.AddTransient<ITenantResolver, JwtClaimTenantResolver>();

        // Health checks
        services.AddHealthChecks()
            .AddNpgSql(configuration.GetConnectionString("Default")!, tags: new[] { "ready" })
            .AddRedis(configuration["Redis:Connection"]!, tags: new[] { "ready" });

        // Serilog
        services.AddSerilog(/*...*/);

        // OpenTelemetry
        services.AddOpenTelemetry()
            .WithTracing(t => t.AddAspNetCoreInstrumentation().AddGrpcClientInstrumentation().AddEntityFrameworkCoreInstrumentation().AddOtlpExporter())
            .WithMetrics(m => m.AddAspNetCoreInstrumentation().AddRuntimeInstrumentation().AddOtlpExporter());
    }
}
```

---

## 4. Pattern giao tiếp giữa contexts

### 4.1 Đồng bộ: query aggregate khác

❌ **KHÔNG** inject `IUserRepository` vào `EventAppService`.

✅ **Cách đúng:**

- Lưu snapshot data cần thiết vào aggregate khi raise event (vd: `Event.OrganizerUserId` thay vì lookup mỗi lần)
- Nếu cần query real-time, dùng **read model projection** (vd: `IUserSummaryQuery` interface trong `Shared.Application.Contracts` → implement trong service, đọc từ bảng `user_summaries` được update qua integration event)

### 4.2 Bất đồng bộ: context A → context B

✅ **Dùng integration event:**

```csharp
// Trong EventManagement context: raise integration event
public void Publish()
{
    Status = EventStatus.Published;
    AddIntegrationEvent(new EventPublishedIntegrationEvent(Id, TenantId!.Value, Title, StartAt));
}

// Trong Registration context: consumer
public class EventPublishedHandler : IConsumer<EventPublishedIntegrationEvent>
{
    public async Task Consume(ConsumeContext<EventPublishedIntegrationEvent> context)
    {
        var @event = context.Message;
        // Logic: mở bán ticket types mặc định
        await _ticketTypeService.OpenDefaultSalesAsync(@event.EventId, context.CancellationToken);
    }
}
```

### 4.3 Đồng bộ trong cùng process: domain event local

```csharp
// Trong aggregate
public void MarkPaid()
{
    Status = OrderStatus.Paid;
    AddDomainEvent(new OrderPaidDomainEvent(Id, TenantId, TotalAmount));
}

// Handler in-process qua MediatR
public class OrderPaidHandler : INotificationHandler<OrderPaidDomainEvent>
{
    public async Task Handle(OrderPaidDomainEvent notification, CancellationToken ct)
    {
        await _registrationService.IssueTicketAsync(notification.OrderId, ct);
    }
}
```

---

## 5. Database isolation giữa contexts

Mặc dù 1 DbContext duy nhất (`SaasCheckinDbContext`), mỗi bounded context có **schema** riêng (tùy chọn, bật ở Phase 2+):

```csharp
// SaasCheckin.EntityFrameworkCore/Configurations/Identity/UserConfiguration.cs
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users", schema: "identity");  // ← schema isolation
        // ...
    }
}

// EventManagement/EventConfiguration.cs
public class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> b)
    {
        b.ToTable("events", schema: "event_mgmt");
        // ...
    }
}
```

Tất cả schema đều có `tenant_id` + RLS policy. Migration generate prefix theo schema: `20260101_identity_init.cs`, `20260115_event_mgmt_init.cs`, ...

---

## 6. Anti-pattern cần tránh

| ❌ Anti-pattern | ✅ Cách đúng |
|---|---|
| Inject `DbContext` hoặc `IRepository<>` của context A vào Application Service của context B | Tạo query interface riêng ở `Application.Contracts`; hoặc dùng read-model projection |
| `using SaasCheckin.Domain.Identity;` trong file thuộc `SaasCheckin.Domain.Registration` | Dùng integration event để decouple; hoặc nếu buộc phải share, move VO vào `SaasCheckin.Domain.Core` |
| Aggregate A gọi `aggregateB.Method()` trực tiếp | Reference qua ID; load qua repository khi cần |
| Public setter `public string Name { get; set; }` | Private setter + method hành vi `Rename(string newName)` enforce invariant |
| Repository expose `IQueryable<T>` mặc định | Chỉ expose trong `AsQueryable()` cho query phức tạp; default method trả materialized list |
| Outbox được tạo trong transaction riêng (sau khi SaveChanges) | Outbox phải insert trong **cùng transaction** với business data |

---

## 7. Sơ đồ tổng quan

```
                          ┌─────────────────────────────┐
                          │  SaasCheckin.HttpApi.Host   │
                          │  (composition root)         │
                          └──────────────┬──────────────┘
                                         │ load + wire
                                         ▼
       ┌───────────┬────────────┬──────────────┬──────────────┬──────────────┐
       ▼           ▼            ▼              ▼              ▼              ▼
   Identity    EventMgmt   Registration    CheckIn       Billing     Notification
   Module      Module      Module          Module        Module       Module
       │           │            │              │              │              │
       │           │            │              │              │              │
       └───────────┴────────────┴──────┬───────┴──────────────┴──────────────┘
                                       ▼
                          ┌─────────────────────────────┐
                          │  SaasCheckin.DbContext      │
                          │  (Postgres + RLS)           │
                          └─────────────────────────────┘
                                       ▲
                                       │ gọi từ
                          ┌────────────┴────────────┐
                          │  apps/api-gateway/      │
                          │  (NestJS BFF)           │
                          │  → gRPC + REST + WSS    │
                          └─────────────────────────┘
                                       ▲
                                       │ HTTPS + WSS
                          ┌────────────┴────────────┐
                          │  Web (Next.js)          │
                          │  Mobile (Flutter)       │
                          └─────────────────────────┘
```

Mỗi module có thể split thành microservice riêng trong tương lai nếu cần scale độc lập (vd: tách `CheckIn` thành service riêng khi throughput vượt 5000 scan/giây). Boundary giữa module đã rõ ràng — chỉ cần tạo solution mới, copy 1 module, expose qua gRPC.
