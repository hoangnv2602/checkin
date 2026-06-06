// apps/core-api/src/SaasCheckin.Domain/Billing/Aggregates/Payout.cs
// I-803 — Payout aggregate. Tracks Stripe payout lifecycle cho organizer.
//
// States (Stateless state machine — wire ở Phase 9+):
//   Pending → InTransit → Paid
//                  ↓
//               Failed
//
// Mỗi Payout thuộc 1 Organization (organizer), 1 Order hoặc aggregated nhiều orders.
namespace SaasCheckin.Domain.Billing.Aggregates;

using System;
using SaasCheckin.Domain.Billing.Events;
using SaasCheckin.Domain.Billing.ValueObjects;

public enum PayoutStatus
{
    Pending = 0,
    InTransit = 1,
    Paid = 2,
    Failed = 3,
}

public class Payout
{
    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public string StripeAccountId { get; private set; } = "";
    public string? StripePayoutId { get; private set; }
    public long AmountMinor { get; private set; }
    public string Currency { get; private set; } = "USD";
    public CommissionRate Commission { get; private set; }
    public PayoutStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? PaidAt { get; private set; }
    public string? FailureReason { get; private set; }

    private readonly List<object> _domainEvents = new();
    public IReadOnlyList<object> DomainEvents => _domainEvents;

    // EF Core constructor
    private Payout() { }

    public static Payout Schedule(
        Guid organizationId,
        string stripeAccountId,
        long amountMinor,
        string currency,
        CommissionRate commission)
    {
        if (amountMinor <= 0) throw new ArgumentException("amount must be positive", nameof(amountMinor));
        if (string.IsNullOrWhiteSpace(stripeAccountId)) throw new ArgumentException("stripeAccountId required");

        var payout = new Payout
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            StripeAccountId = stripeAccountId,
            AmountMinor = amountMinor,
            Currency = currency.ToUpperInvariant(),
            Commission = commission,
            Status = PayoutStatus.Pending,
            CreatedAt = DateTime.UtcNow,
        };
        payout._domainEvents.Add(new PayoutScheduledDomainEvent(
            payout.Id, organizationId, amountMinor, currency, commission.BasisPoints));
        return payout;
    }

    public void MarkInTransit(string stripePayoutId)
    {
        if (Status != PayoutStatus.Pending)
            throw new InvalidOperationException($"Cannot mark in-transit from {Status}");
        StripePayoutId = stripePayoutId;
        Status = PayoutStatus.InTransit;
    }

    public void MarkPaid()
    {
        if (Status != PayoutStatus.InTransit)
            throw new InvalidOperationException($"Cannot mark paid from {Status}");
        Status = PayoutStatus.Paid;
        PaidAt = DateTime.UtcNow;
        _domainEvents.Add(new PayoutCompletedDomainEvent(Id, OrganizationId, AmountMinor, Currency));
    }

    public void MarkFailed(string reason)
    {
        Status = PayoutStatus.Failed;
        FailureReason = reason;
        _domainEvents.Add(new PayoutFailedDomainEvent(Id, OrganizationId, reason));
    }
}
