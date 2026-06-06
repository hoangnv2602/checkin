using SaasCheckin.Domain.Registration.Events;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.Registration.Aggregates;

/// <summary>
/// TicketType — defines 1 loại vé cho 1 event (VD: "VIP", "Standard", "Early-bird").
/// Mỗi event có nhiều TicketType; mỗi TicketType có price, capacity, sale window.
/// </summary>
public sealed class TicketType : AggregateRoot<TicketTypeId>
{
    public Guid OrganizationId { get; private set; }
    public Guid EventId { get; private set; }
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public Money Price { get; private set; }
    public int Capacity { get; private set; }
    public int SoldCount { get; private set; }
    public DateTimeOffset SaleStartsAt { get; private set; }
    public DateTimeOffset SaleEndsAt { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private TicketType() : base(default!) { }

    private TicketType(
        TicketTypeId id,
        Guid orgId,
        Guid eventId,
        string name,
        string? description,
        Money price,
        int capacity,
        DateTimeOffset saleStartsAt,
        DateTimeOffset saleEndsAt,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(eventId, nameof(eventId));
        if (eventId == Guid.Empty) throw new ArgumentException("EventId required", nameof(eventId));
        Guard.NotNullOrWhiteSpace(name, nameof(name));
        if (name.Length > 100) throw new ArgumentException("Name > 100 chars", nameof(name));
        if (capacity <= 0) throw new ArgumentException("Capacity must be > 0", nameof(capacity));
        if (saleStartsAt >= saleEndsAt)
            throw new ArgumentException("Sale start must be < end", nameof(saleStartsAt));

        OrganizationId = orgId;
        EventId = eventId;
        Name = name.Trim();
        Description = description?.Trim();
        Price = price;
        Capacity = capacity;
        SaleStartsAt = saleStartsAt;
        SaleEndsAt = saleEndsAt;
        IsActive = true;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static TicketType Create(
        Guid organizationId,
        Guid eventId,
        string name,
        string? description,
        Money price,
        int capacity,
        DateTimeOffset saleStartsAt,
        DateTimeOffset saleEndsAt,
        IClock clock)
        => new(TicketTypeId.New(), organizationId, eventId, name, description, price,
               capacity, saleStartsAt, saleEndsAt, clock);

    public void Update(
        string? name,
        string? description,
        Money? price,
        int? capacity,
        DateTimeOffset? saleStartsAt,
        DateTimeOffset? saleEndsAt,
        IClock clock)
    {
        if (name is not null)
        {
            Guard.NotNullOrWhiteSpace(name, nameof(name));
            if (name.Length > 100) throw new ArgumentException("Name > 100 chars");
            Name = name.Trim();
        }
        if (description is not null) Description = description.Trim();
        if (price.HasValue) Price = price.Value;
        if (capacity.HasValue)
        {
            if (capacity.Value < SoldCount)
                throw new InvalidOperationException(
                    $"Cannot reduce capacity ({capacity.Value}) below sold ({SoldCount})");
            if (capacity.Value <= 0) throw new ArgumentException("Capacity must be > 0");
            Capacity = capacity.Value;
        }
        if (saleStartsAt.HasValue) SaleStartsAt = saleStartsAt.Value;
        if (saleEndsAt.HasValue) SaleEndsAt = saleEndsAt.Value;
        if (SaleStartsAt >= SaleEndsAt)
            throw new InvalidOperationException("Sale start must be < end");
        UpdatedAt = clock.UtcNow;
    }

    public void Deactivate(IClock clock)
    {
        IsActive = false;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new TicketTypeDeactivated(Id, OrganizationId, EventId, clock.UtcNow));
    }

    /// <summary>Reserve seats. Called by Order aggregate khi tạo order.</summary>
    public void ReserveSeats(int quantity, IClock clock)
    {
        if (quantity <= 0) throw new ArgumentException("Quantity must be > 0", nameof(quantity));
        if (!IsActive) throw new InvalidOperationException("TicketType is not active");
        var now = clock.UtcNow;
        if (now < SaleStartsAt) throw new InvalidOperationException("Sale window has not opened");
        if (now >= SaleEndsAt) throw new InvalidOperationException("Sale window has closed");
        if (SoldCount + quantity > Capacity)
            throw new InvalidOperationException(
                $"Sold ({SoldCount + quantity}) would exceed capacity ({Capacity})");
        SoldCount += quantity;
        UpdatedAt = now;
    }

    /// <summary>Release seats khi order cancelled/failed.</summary>
    public void ReleaseSeats(int quantity, IClock clock)
    {
        if (quantity <= 0) throw new ArgumentException("Quantity must be > 0", nameof(quantity));
        if (SoldCount - quantity < 0)
            throw new InvalidOperationException("Cannot release more seats than sold");
        SoldCount -= quantity;
        UpdatedAt = clock.UtcNow;
    }
}
