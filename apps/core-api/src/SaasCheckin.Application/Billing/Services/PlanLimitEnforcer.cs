using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.Services;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Billing.Services;

/// <summary>
/// PlanLimitEnforcer — query live usage từ DB, so với plan limits. Cache
/// trong Redis 5 phút; invalidate khi subscription đổi (I-502 sẽ wire).
/// </summary>
public sealed class PlanLimitEnforcer : IPlanLimitEnforcer
{
    public PlanLimitEnforcer(
        ISubscriptionRepository subs,
        IPlanRepository plans,
        IEventRepository events,
        IRegistrationRepository registrations,
        // IClock + IConnectionMultiplexer injected in Infrastructure impl
        object? redis = null)
    {
        _subs = subs;
        _plans = plans;
        _events = events;
        _registrations = registrations;
        _redis = redis;
    }

    private readonly ISubscriptionRepository _subs;
    private readonly IPlanRepository _plans;
    private readonly IEventRepository _events;
    private readonly IRegistrationRepository _registrations;
    private readonly object? _redis;

    public async Task<PlanLimitCheck> CheckAsync(
        Guid organizationId,
        PlanLimitKind kind,
        int requestedDelta = 1,
        CancellationToken ct = default)
    {
        var sub = await _subs.FindByOrganizationAsync(organizationId, ct);
        if (sub is null) return PlanLimitCheck.NoSubscription();
        if (!sub.IsActive) return PlanLimitCheck.NoSubscription();

        var plan = await _plans.FindByIdAsync(sub.PlanId, ct);
        if (plan is null) return PlanLimitCheck.NoSubscription();

        return kind switch
        {
            PlanLimitKind.ActiveEvents => await CheckActiveEvents(organizationId, plan, ct),
            PlanLimitKind.AttendeesThisMonth => await CheckAttendeesThisMonth(organizationId, plan, requestedDelta, ct),
            PlanLimitKind.StaffSeats => await CheckStaffSeats(organizationId, plan, requestedDelta, ct),
            _ => PlanLimitCheck.Ok(),
        };
    }

    private async Task<PlanLimitCheck> CheckActiveEvents(Guid orgId, Plan plan, CancellationToken ct)
    {
        var events = await _events.ListAsync(orgId, null, 0, int.MaxValue, ct);
        var published = events.Count(e => e.Status == EventStatus.Published);
        if (published >= plan.MaxActiveEvents)
            return PlanLimitCheck.Exceeded(plan.MaxActiveEvents, published,
                $"Active events limit reached ({published}/{plan.MaxActiveEvents})");
        return PlanLimitCheck.Ok();
    }

    private async Task<PlanLimitCheck> CheckAttendeesThisMonth(Guid orgId, Plan plan, int delta, CancellationToken ct)
    {
        var startOfMonth = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var events = await _events.ListAsync(orgId, null, 0, int.MaxValue, ct);
        var totalAttendees = 0;
        foreach (var e in events)
        {
            var regs = await _registrations.ListByEventAsync(e.Id.Value, orgId, 0, int.MaxValue, ct);
            totalAttendees += regs.Count(r => r.IssuedAt >= startOfMonth);
        }
        if (totalAttendees + delta > plan.MaxAttendeesPerMonth)
            return PlanLimitCheck.Exceeded(plan.MaxAttendeesPerMonth, totalAttendees,
                $"Monthly attendees limit reached ({totalAttendees}/{plan.MaxAttendeesPerMonth})");
        return PlanLimitCheck.Ok();
    }

    private Task<PlanLimitCheck> CheckStaffSeats(Guid orgId, Plan plan, int delta, CancellationToken ct)
    {
        // Phase 5 stub: luôn OK. Phase 6 sẽ query Membership aggregate.
        return Task.FromResult(PlanLimitCheck.Ok());
    }
}
