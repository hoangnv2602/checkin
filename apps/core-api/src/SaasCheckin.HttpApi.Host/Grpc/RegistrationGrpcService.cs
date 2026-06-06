using Grpc.Core;
using MediatR;
using Microsoft.Extensions.Logging;
using SaasCheckin.Application.Registration.Commands;
using SaasCheckin.Application.Registration.Queries;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// Ticketing gRPC service. BFF (NestJS api-gateway) gọi tới đây để
/// list/get ticket types, apply discount, create/attach/mark-paid order,
/// get order, list registrations.
///
/// Tenant context đến qua metadata <c>organization_id</c> trên từng request
/// → set qua <see cref="ICurrentTenant"/> trước khi handler chạy.
///
/// Pattern: raw POCO message types + manual <see cref="BindService"/> (mirror
/// IdentityGrpcService / EventGrpcService). Khi `buf generate` chạy (I-105
/// follow-up), sẽ thay bằng generated abstract base + static <c>Service</c>.
/// </summary>
public sealed class RegistrationGrpcService
{
    private const string ServiceName = "saas_checkin.ticketing.v1.TicketingService";

    private readonly IMediator _mediator;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<RegistrationGrpcService> _logger;

    public RegistrationGrpcService(
        IMediator mediator,
        ICurrentTenant currentTenant,
        ILogger<RegistrationGrpcService> logger)
    {
        _mediator = mediator;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public ServerServiceDefinition BindService()
    {
        var b = ServerServiceDefinition.CreateBuilder();
        b.AddMethod(BuildMethod<ListTicketTypesRequest, ListTicketTypesResponse>("ListTicketTypes"),
            (req, ctx) => ListTicketTypes(req, ctx));
        b.AddMethod(BuildMethod<GetTicketTypeRequest, TicketTypeMessage>("GetTicketType"),
            (req, ctx) => GetTicketType(req, ctx));
        b.AddMethod(BuildMethod<ApplyDiscountRequest, ApplyDiscountResponse>("ApplyDiscount"),
            (req, ctx) => ApplyDiscount(req, ctx));
        b.AddMethod(BuildMethod<CreateOrderRequest, CreateOrderResponse>("CreateOrder"),
            (req, ctx) => CreateOrder(req, ctx));
        b.AddMethod(BuildMethod<AttachProviderSessionRequest, AttachProviderSessionResponse>("AttachProviderSession"),
            (req, ctx) => AttachProviderSession(req, ctx));
        b.AddMethod(BuildMethod<MarkOrderPaidRequest, MarkOrderPaidResponse>("MarkOrderPaid"),
            (req, ctx) => MarkOrderPaid(req, ctx));
        b.AddMethod(BuildMethod<GetOrderRequest, OrderMessage>("GetOrder"),
            (req, ctx) => GetOrder(req, ctx));
        b.AddMethod(BuildMethod<ListRegistrationsRequest, ListRegistrationsResponse>("ListRegistrations"),
            (req, ctx) => ListRegistrations(req, ctx));
        return b.Build();
    }

    private static Method<TRequest, TResponse> BuildMethod<TRequest, TResponse>(string name)
        where TRequest : class where TResponse : class
        => new(
            MethodType.Unary, ServiceName, name,
            CreateMarshaller<TRequest>(),
            CreateMarshaller<TResponse>());

    private static Marshaller<T> CreateMarshaller<T>() where T : class
        => Marshallers.Create(
            (T value) => System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(value),
            (byte[] data) => System.Text.Json.JsonSerializer.Deserialize<T>(data)
                ?? throw new InvalidOperationException("Cannot deserialize gRPC payload"));

    // ===== Ticket Types =====

    public async Task<ListTicketTypesResponse> ListTicketTypes(ListTicketTypesRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var types = await _mediator.Send(
            new ListTicketTypesQuery(orgId, eventId), ctx.CancellationToken);
        var resp = new ListTicketTypesResponse();
        resp.TicketTypes.AddRange(types.Select(TicketTypeMessage.From));
        return resp;
    }

    public async Task<TicketTypeMessage> GetTicketType(GetTicketTypeRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var ticketTypeId = ParseGuid(req.TicketTypeId, "ticket_type_id");
        var tt = await _mediator.Send(
            new GetTicketTypeQuery(orgId, ticketTypeId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Ticket type not found"));
        return TicketTypeMessage.From(tt);
    }

    // ===== Pricing =====

    public async Task<ApplyDiscountResponse> ApplyDiscount(ApplyDiscountRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var ticketTypeId = ParseGuid(req.TicketTypeId, "ticket_type_id");
        var result = await _mediator.Send(new ApplyDiscountCommand(
            orgId, eventId, ticketTypeId, req.Quantity, req.DiscountCode ?? string.Empty), ctx.CancellationToken);
        return new ApplyDiscountResponse
        {
            Subtotal = MoneyMessage.From(result.Subtotal),
            Discount = MoneyMessage.From(result.Discount),
            Total = MoneyMessage.From(result.Total),
            AppliedCode = result.AppliedCode ?? string.Empty,
            FailureReason = result.FailureReason ?? string.Empty,
        };
    }

    // ===== Orders =====

    public async Task<CreateOrderResponse> CreateOrder(CreateOrderRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var ticketTypeId = ParseGuid(req.TicketTypeId, "ticket_type_id");
        if (!Enum.TryParse<Domain.Registration.ValueObjects.PaymentProvider>(Capitalize(req.Provider), out var provider))
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Unknown provider: {req.Provider}"));

        var result = await _mediator.Send(new CreateOrderCommand(
            orgId, eventId, ticketTypeId, req.Quantity,
            req.BuyerEmail, req.BuyerName, NullIfEmpty(req.DiscountCode), provider), ctx.CancellationToken);

        // Fetch the persisted Order (CreateOrderResult chỉ có OrderId + money).
        var order = await _mediator.Send(new GetOrderQuery(orgId, result.OrderId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.Internal, "Order created but not found"));
        return new CreateOrderResponse
        {
            Order = OrderMessage.From(order, expiresAtIso: result.ExpiresAt.ToString("O")),
        };
    }

    public async Task<AttachProviderSessionResponse> AttachProviderSession(AttachProviderSessionRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var orderId = ParseGuid(req.OrderId, "order_id");
        await _mediator.Send(new AttachProviderSessionCommand(orgId, orderId, req.ProviderSessionId), ctx.CancellationToken);
        return new AttachProviderSessionResponse { Ok = true };
    }

    public async Task<MarkOrderPaidResponse> MarkOrderPaid(MarkOrderPaidRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var orderId = ParseGuid(req.OrderId, "order_id");
        // MarkOrderPaid chỉ trả IRequest (void) — internally issues N registrations
        // dựa trên order.Quantity. Đếm registrations theo order qua repo
        // ListByOrderAsync nếu cần chính xác; ở đây return 0 (BFF chỉ cần ok=true).
        await _mediator.Send(new MarkOrderPaidCommand(
            orgId, orderId, req.ProviderSessionId ?? string.Empty), ctx.CancellationToken);
        return new MarkOrderPaidResponse { Ok = true, IssuedRegistrations = 0 };
    }

    public async Task<OrderMessage> GetOrder(GetOrderRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var orderId = ParseGuid(req.OrderId, "order_id");
        var order = await _mediator.Send(new GetOrderQuery(orgId, orderId), ctx.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Order not found"));
        return OrderMessage.From(order);
    }

    // ===== Registrations =====

    public async Task<ListRegistrationsResponse> ListRegistrations(ListRegistrationsRequest req, ServerCallContext ctx)
    {
        var orgId = ParseGuid(req.OrganizationId, "organization_id");
        var eventId = ParseGuid(req.EventId, "event_id");
        var regs = await _mediator.Send(new ListRegistrationsQuery(
            orgId, eventId, NullIfEmpty(req.AttendeeEmail), req.Skip, req.Take), ctx.CancellationToken);
        var resp = new ListRegistrationsResponse();
        resp.Registrations.AddRange(regs.Select(RegistrationMessage.From));
        return resp;
    }

    // ===== Helpers =====

    private static Guid ParseGuid(string value, string paramName)
    {
        if (!Guid.TryParse(value, out var id) || id == Guid.Empty)
            throw new RpcException(new Status(StatusCode.InvalidArgument, $"Invalid {paramName}"));
        return id;
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrEmpty(s) ? null : s;

    private static string Capitalize(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];
}

// ===== Raw message types (Phase 3 stand-in cho proto-generated) =====
// Match csharp_namespace "SaasCheckin.Grpc.Ticketing.V1" trong ticketing.proto.

public class TicketTypeMessage
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long PriceAmountMinor { get; set; }
    public string PriceCurrency { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int SoldCount { get; set; }
    public string SaleStartsAt { get; set; } = string.Empty;
    public string SaleEndsAt { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    public static TicketTypeMessage From(Domain.Registration.Aggregates.TicketType t) => new()
    {
        Id = t.Id.ToString(),
        OrganizationId = t.OrganizationId.ToString(),
        EventId = t.EventId.ToString(),
        Name = t.Name,
        Description = t.Description ?? string.Empty,
        PriceAmountMinor = t.Price.AmountMinor,
        PriceCurrency = t.Price.Currency,
        Capacity = t.Capacity,
        SoldCount = t.SoldCount,
        SaleStartsAt = t.SaleStartsAt.ToString("O"),
        SaleEndsAt = t.SaleEndsAt.ToString("O"),
        IsActive = t.IsActive,
    };
}

public class ListTicketTypesRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
}

public class ListTicketTypesResponse
{
    public List<TicketTypeMessage> TicketTypes { get; set; } = new();
}

public class GetTicketTypeRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string TicketTypeId { get; set; } = string.Empty;
}

public class MoneyMessage
{
    public long AmountMinor { get; set; }
    public string Currency { get; set; } = string.Empty;

    public static MoneyMessage From(Domain.Registration.ValueObjects.Money m) => new()
    {
        AmountMinor = m.AmountMinor,
        Currency = m.Currency,
    };
}

public class ApplyDiscountRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string TicketTypeId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string DiscountCode { get; set; } = string.Empty;
}

public class ApplyDiscountResponse
{
    public MoneyMessage Subtotal { get; set; } = new();
    public MoneyMessage Discount { get; set; } = new();
    public MoneyMessage Total { get; set; } = new();
    public string AppliedCode { get; set; } = string.Empty;
    public string FailureReason { get; set; } = string.Empty;
}

public class CreateOrderRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string TicketTypeId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string BuyerEmail { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public string DiscountCode { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
}

public class OrderMessage
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string TicketTypeId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string BuyerEmail { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public MoneyMessage Subtotal { get; set; } = new();
    public MoneyMessage Discount { get; set; } = new();
    public MoneyMessage Total { get; set; } = new();
    public string DiscountCode { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string ProviderSessionId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string ExpiresAt { get; set; } = string.Empty;

    public static OrderMessage From(Domain.Registration.Aggregates.Order o, string? expiresAtIso = null) => new()
    {
        Id = o.Id.ToString(),
        OrganizationId = o.OrganizationId.ToString(),
        EventId = o.EventId.ToString(),
        TicketTypeId = o.TicketTypeId.ToString(),
        Quantity = o.Quantity,
        BuyerEmail = o.BuyerEmail,
        BuyerName = o.BuyerName,
        Subtotal = MoneyMessage.From(o.Subtotal),
        Discount = MoneyMessage.From(o.Discount),
        Total = MoneyMessage.From(o.Total),
        DiscountCode = o.DiscountCode ?? string.Empty,
        Provider = o.Provider.ToString().ToLowerInvariant(),
        ProviderSessionId = o.ProviderSessionId ?? string.Empty,
        Status = o.Status.ToString(),
        CreatedAt = o.CreatedAt.ToString("O"),
        ExpiresAt = expiresAtIso ?? string.Empty,
    };
}

public class CreateOrderResponse
{
    public OrderMessage Order { get; set; } = new();
}

public class AttachProviderSessionRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string ProviderSessionId { get; set; } = string.Empty;
}

public class AttachProviderSessionResponse
{
    public bool Ok { get; set; }
}

public class MarkOrderPaidRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string ProviderSessionId { get; set; } = string.Empty;
}

public class MarkOrderPaidResponse
{
    public bool Ok { get; set; }
    public int IssuedRegistrations { get; set; }
}

public class GetOrderRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
}

public class RegistrationMessage
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string TicketTypeId { get; set; } = string.Empty;
    public string Jti { get; set; } = string.Empty;
    public string AttendeeEmail { get; set; } = string.Empty;
    public string AttendeeName { get; set; } = string.Empty;
    public string AttendeePhone { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string IssuedAt { get; set; } = string.Empty;
    public string ExpiresAt { get; set; } = string.Empty;
    public string CheckedInAt { get; set; } = string.Empty;
    public string QrImageUrl { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;

    public static RegistrationMessage From(Domain.Registration.Aggregates.Registration r) => new()
    {
        Id = r.Id.ToString(),
        OrganizationId = r.OrganizationId.ToString(),
        EventId = r.EventId.ToString(),
        OrderId = r.OrderId.ToString(),
        TicketTypeId = r.TicketTypeId.ToString(),
        Jti = r.Jti.ToString(),
        AttendeeEmail = r.AttendeeEmail,
        AttendeeName = r.AttendeeName,
        AttendeePhone = r.AttendeePhone ?? string.Empty,
        Status = r.Status.ToString(),
        IssuedAt = r.IssuedAt.ToString("O"),
        ExpiresAt = r.ExpiresAt.ToString("O"),
        CheckedInAt = r.CheckedInAt?.ToString("O") ?? string.Empty,
        QrImageUrl = r.QrImageUrl ?? string.Empty,
        Signature = r.Signature ?? string.Empty,
    };
}

public class ListRegistrationsRequest
{
    public string OrganizationId { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string AttendeeEmail { get; set; } = string.Empty;
    public int Skip { get; set; }
    public int Take { get; set; }
}

public class ListRegistrationsResponse
{
    public List<RegistrationMessage> Registrations { get; set; } = new();
}
