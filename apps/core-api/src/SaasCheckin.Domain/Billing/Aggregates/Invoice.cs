using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.Billing.Aggregates;

/// <summary>
/// Invoice — record of a successful charge. Append-only; immutable.
/// </summary>
public sealed class Invoice : AggregateRoot<InvoiceId>
{
    public Guid OrganizationId { get; private set; }
    public SubscriptionId SubscriptionId { get; private set; }
    public Money Amount { get; private set; }
    public string Currency => Amount.Currency;
    public string? ProviderInvoiceId { get; private set; }
    public DateTimeOffset IssuedAt { get; private set; }
    public DateTimeOffset? PaidAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private Invoice() : base(default!) { }

    private Invoice(
        InvoiceId id,
        Guid orgId,
        SubscriptionId subId,
        Money amount,
        string? providerInvoiceId,
        DateTimeOffset? paidAt,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(subId, nameof(subId));
        if (subId.Value == Guid.Empty) throw new ArgumentException("SubscriptionId required", nameof(subId));
        if (amount.IsZero) throw new ArgumentException("Invoice amount must be > 0", nameof(amount));

        OrganizationId = orgId;
        SubscriptionId = subId;
        Amount = amount;
        ProviderInvoiceId = providerInvoiceId;
        var now = clock.UtcNow;
        IssuedAt = now;
        PaidAt = paidAt;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static Invoice Issue(
        Guid organizationId,
        SubscriptionId subscriptionId,
        Money amount,
        IClock clock,
        string? providerInvoiceId = null) =>
        new(InvoiceId.New(), organizationId, subscriptionId, amount, providerInvoiceId, null, clock);

    public void MarkPaid(DateTimeOffset paidAt, IClock clock)
    {
        if (PaidAt.HasValue) return;
        PaidAt = paidAt;
        UpdatedAt = clock.UtcNow;
    }
}
