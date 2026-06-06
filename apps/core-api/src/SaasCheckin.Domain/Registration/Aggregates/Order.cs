using SaasCheckin.Domain.Registration.Events;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.Registration.Aggregates;

/// <summary>
/// Order — 1 giao dịch mua vé. Vòng đời:
///   Pending → Paid (qua MarkPaid)
///   Pending → Failed (qua MarkFailed)
///   Paid → Refunded (qua Refund — Phase 5+)
///
/// Order KHÔNG tự tính tiền — IPricingService resolve price/discount bên ngoài,
/// truyền Subtotal/Total/Discount vào MarkPending. Aggregate chỉ giữ state machine.
/// </summary>
public sealed class Order : AggregateRoot<OrderId>
{
    public Guid OrganizationId { get; private set; }
    public Guid EventId { get; private set; }
    public Guid TicketTypeId { get; private set; }
    public int Quantity { get; private set; }
    public string BuyerEmail { get; private set; } = default!;
    public string BuyerName { get; private set; } = default!;
    public Money Subtotal { get; private set; }
    public Money Discount { get; private set; }
    public Money Total { get; private set; }
    public string? DiscountCode { get; private set; }
    public PaymentProvider Provider { get; private set; }
    public string? ProviderSessionId { get; private set; }     // Stripe Session / VNPay txn ref
    public OrderStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }      // pending timeout (10 phút)

    private Order() : base(default!) { }

    private Order(
        OrderId id,
        Guid orgId,
        Guid eventId,
        Guid ticketTypeId,
        int quantity,
        string buyerEmail,
        string buyerName,
        Money subtotal,
        Money discount,
        Money total,
        string? discountCode,
        PaymentProvider provider,
        DateTimeOffset expiresAt,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(eventId, nameof(eventId));
        if (eventId == Guid.Empty) throw new ArgumentException("EventId required", nameof(eventId));
        Guard.NotNullStruct(ticketTypeId, nameof(ticketTypeId));
        if (ticketTypeId == Guid.Empty) throw new ArgumentException("TicketTypeId required", nameof(ticketTypeId));
        if (quantity <= 0) throw new ArgumentException("Quantity must be > 0", nameof(quantity));
        Guard.NotNullOrWhiteSpace(buyerEmail, nameof(buyerEmail));
        Guard.NotNullOrWhiteSpace(buyerName, nameof(buyerName));
        if (buyerName.Length > 200) throw new ArgumentException("BuyerName > 200 chars", nameof(buyerName));
        // total = subtotal - discount; assert currency match
        if (!string.Equals(subtotal.Currency, total.Currency, StringComparison.Ordinal) ||
            !string.Equals(discount.Currency, total.Currency, StringComparison.Ordinal))
            throw new ArgumentException("Currency mismatch in order totals");
        if (subtotal.AmountMinor - discount.AmountMinor != total.AmountMinor)
            throw new ArgumentException("Total must equal Subtotal - Discount");

        OrganizationId = orgId;
        EventId = eventId;
        TicketTypeId = ticketTypeId;
        Quantity = quantity;
        BuyerEmail = buyerEmail.Trim().ToLowerInvariant();
        BuyerName = buyerName.Trim();
        Subtotal = subtotal;
        Discount = discount;
        Total = total;
        DiscountCode = discountCode?.Trim().ToUpperInvariant();
        Provider = provider;
        Status = OrderStatus.Pending;
        ExpiresAt = expiresAt;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static Order Create(
        Guid organizationId,
        Guid eventId,
        Guid ticketTypeId,
        int quantity,
        string buyerEmail,
        string buyerName,
        Money subtotal,
        Money discount,
        Money total,
        string? discountCode,
        PaymentProvider provider,
        TimeSpan pendingTimeout,
        IClock clock)
    {
        if (pendingTimeout <= TimeSpan.Zero)
            throw new ArgumentException("Pending timeout must be > 0", nameof(pendingTimeout));
        var expiresAt = clock.UtcNow.Add(pendingTimeout);
        return new Order(OrderId.New(), organizationId, eventId, ticketTypeId, quantity,
                         buyerEmail, buyerName, subtotal, discount, total, discountCode,
                         provider, expiresAt, clock);
    }

    public void AttachProviderSession(string sessionId, IClock clock)
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException($"Cannot attach session in status {Status}");
        Guard.NotNullOrWhiteSpace(sessionId, nameof(sessionId));
        ProviderSessionId = sessionId.Trim();
        UpdatedAt = clock.UtcNow;
    }

    public void MarkPaid(string providerSessionId, IClock clock)
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException($"Cannot mark paid in status {Status}");
        Status = OrderStatus.Paid;
        ProviderSessionId = providerSessionId;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new OrderPaid(Id, OrganizationId, EventId, TicketTypeId, Quantity,
                                       Total, clock.UtcNow));
    }

    public void MarkFailed(string reason, IClock clock)
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException($"Cannot mark failed in status {Status}");
        Status = OrderStatus.Failed;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new OrderFailed(Id, OrganizationId, EventId, TicketTypeId, Quantity,
                                         reason ?? "unknown", clock.UtcNow));
    }

    public bool IsExpiredAt(DateTimeOffset now) =>
        Status == OrderStatus.Pending && now >= ExpiresAt;
}

public enum OrderStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Refunded = 3
}
