using FluentAssertions;
using Moq;
using SaasCheckin.Application.Billing.Commands;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Application.Tests.Billing;

public class CheckPlanLimitCommandHandlerTests
{
    private static readonly Guid OrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly DateTimeOffset Now = new(2026, 6, 5, 10, 0, 0, TimeSpan.Zero);

    private sealed class FixedClock : IClock
    {
        public FixedClock(DateTimeOffset now) => UtcNow = now;
        public DateTimeOffset UtcNow { get; }
    }

    [Fact]
    public async Task Returns_allowed_when_no_subscription()
    {
        var subs = new Mock<ISubscriptionRepository>();
        subs.Setup(s => s.FindByOrganizationAsync(OrgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Subscription?)null);
        var plans = new Mock<IPlanRepository>();
        var events = new Mock<IEventRepository>();
        var regs = new Mock<IRegistrationRepository>();
        var enforcer = new Mock<SaasCheckin.Domain.Billing.Services.IPlanLimitEnforcer>();
        var handler = new CheckPlanLimitCommandHandler(enforcer.Object, subs.Object, plans.Object, events.Object, regs.Object);

        var result = await handler.Handle(new CheckPlanLimitCommand(OrgId, PlanLimitKind.ActiveEvents), default);

        result.Allowed.Should().BeTrue();
    }

    [Fact]
    public async Task Returns_blocked_when_over_active_events_limit()
    {
        var plan = Plan.Create("Pro", PlanTier.Pro,
            new Money(100_000, "VND"), BillingPeriod.Monthly,
            maxActiveEvents: 1, maxAttendeesPerMonth: 1000, maxStaffSeats: 10,
            isDefault: false, new FixedClock(Now));
        // Use StartTrial so subscription starts in Trial state (avoid the
        // pre-existing Activate() factory bug that tries to fire Activate
        // from initial Active state). For limit-checking tests, state doesn't
        // matter — only IsActive does, and Trial counts as active.
        var sub = Subscription.StartTrial(OrgId, plan.Id, TimeSpan.FromDays(14), TimeSpan.FromDays(30), new FixedClock(Now));
        var eventsList = new List<Event> { MakeEvent(EventStatus.Published) };

        var subs = new Mock<ISubscriptionRepository>();
        subs.Setup(s => s.FindByOrganizationAsync(OrgId, It.IsAny<CancellationToken>())).ReturnsAsync(sub);
        var plans = new Mock<IPlanRepository>();
        plans.Setup(p => p.FindByIdAsync(plan.Id, It.IsAny<CancellationToken>())).ReturnsAsync(plan);
        var events = new Mock<IEventRepository>();
        events.Setup(e => e.ListAsync(OrgId, null, 0, int.MaxValue, It.IsAny<CancellationToken>())).ReturnsAsync(eventsList);
        var regs = new Mock<IRegistrationRepository>();
        var enforcer = new Mock<SaasCheckin.Domain.Billing.Services.IPlanLimitEnforcer>();
        var handler = new CheckPlanLimitCommandHandler(enforcer.Object, subs.Object, plans.Object, events.Object, regs.Object);

        var result = await handler.Handle(new CheckPlanLimitCommand(OrgId, PlanLimitKind.ActiveEvents), default);

        result.Allowed.Should().BeFalse();
        result.Code.Should().Be("plan_limit_exceeded");
        result.Limit.Should().Be(1);
        result.Current.Should().Be(1);
    }

    [Fact]
    public async Task Returns_allowed_when_within_active_events_limit()
    {
        var plan = Plan.Create("Pro", PlanTier.Pro,
            new Money(100_000, "VND"), BillingPeriod.Monthly,
            maxActiveEvents: 5, maxAttendeesPerMonth: 1000, maxStaffSeats: 10,
            isDefault: false, new FixedClock(Now));
        var sub = Subscription.StartTrial(OrgId, plan.Id, TimeSpan.FromDays(14), TimeSpan.FromDays(30), new FixedClock(Now));

        var subs = new Mock<ISubscriptionRepository>();
        subs.Setup(s => s.FindByOrganizationAsync(OrgId, It.IsAny<CancellationToken>())).ReturnsAsync(sub);
        var plans = new Mock<IPlanRepository>();
        plans.Setup(p => p.FindByIdAsync(plan.Id, It.IsAny<CancellationToken>())).ReturnsAsync(plan);
        var events = new Mock<IEventRepository>();
        events.Setup(e => e.ListAsync(OrgId, null, 0, int.MaxValue, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Event>());
        var regs = new Mock<IRegistrationRepository>();
        var enforcer = new Mock<SaasCheckin.Domain.Billing.Services.IPlanLimitEnforcer>();
        var handler = new CheckPlanLimitCommandHandler(enforcer.Object, subs.Object, plans.Object, events.Object, regs.Object);

        var result = await handler.Handle(new CheckPlanLimitCommand(OrgId, PlanLimitKind.ActiveEvents), default);

        result.Allowed.Should().BeTrue();
        result.Current.Should().Be(0);
        result.Limit.Should().Be(5);
    }

    private static Event MakeEvent(EventStatus status)
    {
        var period = EventPeriod.Create(Now.AddDays(-1), Now.AddDays(7));
        var capacity = Capacity.Create(100);
        var evt = Event.Create(OrgId, "Test event", "desc", period, capacity, new FixedClock(Now));
        if (status == EventStatus.Published) evt.Publish(new FixedClock(Now));
        return evt;
    }
}
