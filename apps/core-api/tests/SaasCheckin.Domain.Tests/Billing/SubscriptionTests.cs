using FluentAssertions;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.Billing;

internal sealed class FixedClock : IClock
{
    public FixedClock(DateTimeOffset now) => UtcNow = now;
    public DateTimeOffset UtcNow { get; }
}

public class SubscriptionTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid PlanGuid = Guid.NewGuid();
    private static readonly PlanId Plan = PlanId.From(PlanGuid);
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);
    private static readonly FixedClock Clock = new(Now);

    [Fact]
    public void StartTrial_initializes_trial_state()
    {
        var sub = Subscription.StartTrial(OrgId, Plan, TimeSpan.FromDays(14), TimeSpan.FromDays(30), Clock);
        sub.State.Should().Be(SubscriptionState.Trial);
        sub.IsActive.Should().BeTrue();
        sub.IsTrialActive.Should().BeTrue();
        sub.TrialEndsAt.Should().Be(Now.AddDays(14));
    }

    [Fact]
    public void StartTrial_rejects_non_positive_trial_duration()
    {
        Action act = () => Subscription.StartTrial(OrgId, Plan, TimeSpan.Zero, TimeSpan.FromDays(30), Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Activate_from_Trial_moves_to_Active()
    {
        var sub = Subscription.StartTrial(OrgId, Plan, TimeSpan.FromDays(14), TimeSpan.FromDays(30), Clock);
        var later = new FixedClock(Now.AddDays(15));
        // Move to Active by Cancel then re-Activate is invalid flow.
        // Use UpgradePlan which fires Activate.
        // Actually we just trigger Activate directly by accessing State (private).
        // For test: assert state machine allows it via UpgradePlan.
        sub.UpgradePlan(Plan, later);
        sub.State.Should().Be(SubscriptionState.Active);
    }

    [Fact]
    public void Cancel_from_Active_raises_integration_event()
    {
        var sub = Subscription.Activate(OrgId, Plan, TimeSpan.FromDays(30), "sub_test", Clock);
        sub.Cancel(Clock);
        sub.State.Should().Be(SubscriptionState.Cancelled);
        sub.CancelledAt.Should().Be(Now);
        sub.DomainEvents.Should().Contain(e => e.GetType().Name == "SubscriptionCancelledIntegrationEvent");
    }

    [Fact]
    public void MarkPastDue_from_Active_works()
    {
        var sub = Subscription.Activate(OrgId, Plan, TimeSpan.FromDays(30), "sub_test", Clock);
        sub.MarkPastDue(Clock);
        sub.State.Should().Be(SubscriptionState.PastDue);
        sub.DomainEvents.Should().Contain(e => e.GetType().Name == "SubscriptionPastDue");
    }

    [Fact]
    public void UpgradePlan_changes_plan_id()
    {
        var sub = Subscription.Activate(OrgId, Plan, TimeSpan.FromDays(30), "sub_test", Clock);
        var newPlan = PlanId.New();
        sub.UpgradePlan(newPlan, Clock);
        sub.PlanId.Should().Be(newPlan);
        sub.DomainEvents.Should().Contain(e => e.GetType().Name == "SubscriptionActivated");
    }

    [Fact]
    public void IsActive_returns_false_after_cancel()
    {
        var sub = Subscription.Activate(OrgId, Plan, TimeSpan.FromDays(30), "sub_test", Clock);
        sub.Cancel(Clock);
        sub.IsActive.Should().BeFalse();
    }
}
