using SaasCheckin.Domain.Billing.Events;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Stateless;

namespace SaasCheckin.Domain.Billing.Aggregates;

/// <summary>
/// Subscription — 1 org subscribe 1 plan. State machine (Stateless):
///   Trial → Active → PastDue → Cancelled
///                ↘ Cancelled (immediate cancel)
///
/// Trigger integration event: SubscriptionCancelledIntegrationEvent cho
/// Identity context suspend org khi trial hết / chủ động cancel.
/// </summary>
public sealed class Subscription : AggregateRoot<SubscriptionId>
{
    public Guid OrganizationId { get; private set; }
    public PlanId PlanId { get; private set; }
    public SubscriptionState State { get; private set; }
    public DateTimeOffset CurrentPeriodStart { get; private set; }
    public DateTimeOffset CurrentPeriodEnd { get; private set; }
    public DateTimeOffset? TrialEndsAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public string? ExternalSubscriptionId { get; private set; }  // Stripe sub_*
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private readonly StateMachine<SubscriptionState, SubscriptionTrigger> _machine;

    private Subscription() : base(default!) { _machine = null!; }

    private Subscription(
        SubscriptionId id,
        Guid orgId,
        PlanId planId,
        DateTimeOffset periodStart,
        DateTimeOffset periodEnd,
        DateTimeOffset? trialEndsAt,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(planId, nameof(planId));
        if (planId.Value == Guid.Empty) throw new ArgumentException("PlanId required", nameof(planId));
        if (periodStart >= periodEnd)
            throw new ArgumentException("Period start must be < end", nameof(periodStart));

        OrganizationId = orgId;
        PlanId = planId;
        CurrentPeriodStart = periodStart;
        CurrentPeriodEnd = periodEnd;
        TrialEndsAt = trialEndsAt;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
        State = trialEndsAt.HasValue && trialEndsAt.Value > now
            ? SubscriptionState.Trial
            : SubscriptionState.Active;

        _machine = new StateMachine<SubscriptionState, SubscriptionTrigger>(() => State, s => State = s);
        _machine.Configure(SubscriptionState.Trial)
            .OnEntry(() => UpdateTimestamp(clock))
            .Permit(SubscriptionTrigger.Activate, SubscriptionState.Active)
            .Permit(SubscriptionTrigger.Cancel, SubscriptionState.Cancelled);
        _machine.Configure(SubscriptionState.Active)
            .OnEntry(() => UpdateTimestamp(clock))
            .Permit(SubscriptionTrigger.MarkPastDue, SubscriptionState.PastDue)
            .Permit(SubscriptionTrigger.Cancel, SubscriptionState.Cancelled);
        _machine.Configure(SubscriptionState.PastDue)
            .OnEntry(() => UpdateTimestamp(clock))
            .Permit(SubscriptionTrigger.Activate, SubscriptionState.Active)
            .Permit(SubscriptionTrigger.Cancel, SubscriptionState.Cancelled);
        _machine.Configure(SubscriptionState.Cancelled)
            .OnEntry(() => CancelledAt = clock.UtcNow);
    }

    public static Subscription StartTrial(
        Guid organizationId,
        PlanId planId,
        TimeSpan trialDuration,
        TimeSpan periodDuration,
        IClock clock)
    {
        if (trialDuration <= TimeSpan.Zero)
            throw new ArgumentException("Trial duration must be > 0", nameof(trialDuration));
        var now = clock.UtcNow;
        var trialEnd = now.Add(trialDuration);
        var periodEnd = trialEnd.Add(periodDuration);
        return new Subscription(SubscriptionId.New(), organizationId, planId, now, periodEnd, trialEnd, clock);
    }

    public static Subscription Activate(
        Guid organizationId,
        PlanId planId,
        TimeSpan periodDuration,
        string externalSubscriptionId,
        IClock clock)
    {
        Guard.NotNullOrWhiteSpace(externalSubscriptionId, nameof(externalSubscriptionId));
        var now = clock.UtcNow;
        var sub = new Subscription(SubscriptionId.New(), organizationId, planId,
            now, now.Add(periodDuration), null, clock);
        sub._machine.Fire(SubscriptionTrigger.Activate);
        sub.ExternalSubscriptionId = externalSubscriptionId;
        return sub;
    }

    public void MarkPastDue(IClock clock)
    {
        _machine.Fire(SubscriptionTrigger.MarkPastDue);
        RaiseDomainEvent(new SubscriptionPastDue(Id, OrganizationId, clock.UtcNow));
        UpdateTimestamp(clock);
    }

    public void Cancel(IClock clock)
    {
        _machine.Fire(SubscriptionTrigger.Cancel);
        RaiseDomainEvent(new SubscriptionCancelled(Id, OrganizationId, PlanId, clock.UtcNow));
        // Cross-context: Identity context sẽ suspend org qua IntegrationEventBus
        RaiseDomainEvent(new SubscriptionCancelledIntegrationEvent(
            Id, OrganizationId, PlanId, CancelledAt ?? clock.UtcNow, clock.UtcNow));
    }

    public void UpgradePlan(PlanId newPlanId, IClock clock)
    {
        if (newPlanId.Value == Guid.Empty) throw new ArgumentException("PlanId required", nameof(newPlanId));
        if (newPlanId == PlanId) return;
        PlanId = newPlanId;
        UpdateTimestamp(clock);
        RaiseDomainEvent(new SubscriptionActivated(Id, OrganizationId, newPlanId, clock.UtcNow));
    }

    public bool IsActive => State == SubscriptionState.Active || State == SubscriptionState.Trial;
    public bool IsTrialActive => State == SubscriptionState.Trial
        && TrialEndsAt.HasValue
        && DateTimeOffset.UtcNow < TrialEndsAt.Value;

    private void UpdateTimestamp(IClock clock) => UpdatedAt = clock.UtcNow;
}

public enum SubscriptionState { Trial, Active, PastDue, Cancelled }
public enum SubscriptionTrigger { Activate, MarkPastDue, Cancel }
