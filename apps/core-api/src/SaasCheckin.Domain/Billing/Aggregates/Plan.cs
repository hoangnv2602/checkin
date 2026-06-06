using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.Billing.Aggregates;

/// <summary>
/// Plan — pricing tier với limit. Global table (không multi-tenant) — chỉ
/// owner platform tạo/sửa qua checkin-admin app (I-108).
///
/// Limits:
///  - maxActiveEvents
///  - maxAttendeesPerMonth
///  - maxStaffSeats
/// </summary>
public sealed class Plan : AggregateRoot<PlanId>
{
    public string Name { get; private set; } = default!;
    public PlanTier Tier { get; private set; }
    public Money Price { get; private set; }
    public BillingPeriod Period { get; private set; }
    public int MaxActiveEvents { get; private set; }
    public int MaxAttendeesPerMonth { get; private set; }
    public int MaxStaffSeats { get; private set; }
    public bool IsDefault { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private Plan() : base(default!) { }

    private Plan(
        PlanId id,
        string name,
        PlanTier tier,
        Money price,
        BillingPeriod period,
        int maxActiveEvents,
        int maxAttendeesPerMonth,
        int maxStaffSeats,
        bool isDefault,
        IClock clock) : base(id)
    {
        Guard.NotNullOrWhiteSpace(name, nameof(name));
        if (maxActiveEvents <= 0) throw new ArgumentException("maxActiveEvents must be > 0", nameof(maxActiveEvents));
        if (maxAttendeesPerMonth <= 0) throw new ArgumentException("maxAttendeesPerMonth must be > 0", nameof(maxAttendeesPerMonth));
        if (maxStaffSeats <= 0) throw new ArgumentException("maxStaffSeats must be > 0", nameof(maxStaffSeats));

        Id = id;
        Name = name.Trim();
        Tier = tier;
        Price = price;
        Period = period;
        MaxActiveEvents = maxActiveEvents;
        MaxAttendeesPerMonth = maxAttendeesPerMonth;
        MaxStaffSeats = maxStaffSeats;
        IsDefault = isDefault;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static Plan Create(
        string name,
        PlanTier tier,
        Money price,
        BillingPeriod period,
        int maxActiveEvents,
        int maxAttendeesPerMonth,
        int maxStaffSeats,
        bool isDefault,
        IClock clock) =>
        new(PlanId.New(), name, tier, price, period, maxActiveEvents, maxAttendeesPerMonth,
            maxStaffSeats, isDefault, clock);

    public void Update(
        string? name,
        Money? price,
        int? maxActiveEvents,
        int? maxAttendeesPerMonth,
        int? maxStaffSeats,
        IClock clock)
    {
        if (name is not null) Name = name.Trim();
        if (price.HasValue) Price = price.Value;
        if (maxActiveEvents.HasValue) MaxActiveEvents = maxActiveEvents.Value;
        if (maxAttendeesPerMonth.HasValue) MaxAttendeesPerMonth = maxAttendeesPerMonth.Value;
        if (maxStaffSeats.HasValue) MaxStaffSeats = maxStaffSeats.Value;
        UpdatedAt = clock.UtcNow;
    }
}
