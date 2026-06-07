using MediatR;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.Services;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Billing.Commands;

/// <summary>
/// CheckPlanLimitCommand — Phase 5 I-502: BFF gọi trước khi mutate (CreateEvent,
/// RegisterAttendee, InviteMember) để check usage vs plan limit. Cache ở BFF
/// Redis 5 phút; invalidate khi subscription đổi.
/// </summary>
public sealed record CheckPlanLimitCommand(
    Guid OrganizationId,
    PlanLimitKind Kind,
    int RequestedDelta = 1) : IRequest<PlanLimitCheckResult>;

public sealed record PlanLimitCheckResult(
    bool Allowed,
    string? Code,
    string? Message,
    int? Limit,
    int? Current);

public enum PlanLimitKind { ActiveEvents, AttendeesThisMonth, StaffSeats }

public sealed class CheckPlanLimitCommandHandler
    : IRequestHandler<CheckPlanLimitCommand, PlanLimitCheckResult>
{
    private readonly IPlanLimitEnforcer _enforcer;
    private readonly ISubscriptionRepository _subs;
    private readonly IPlanRepository _plans;
    private readonly IEventRepository _events;
    private readonly IRegistrationRepository _registrations;

    public CheckPlanLimitCommandHandler(
        IPlanLimitEnforcer enforcer,
        ISubscriptionRepository subs,
        IPlanRepository plans,
        IEventRepository events,
        IRegistrationRepository registrations)
    {
        _enforcer = enforcer;
        _subs = subs;
        _plans = plans;
        _events = events;
        _registrations = registrations;
    }

    public async Task<PlanLimitCheckResult> Handle(CheckPlanLimitCommand cmd, CancellationToken ct)
    {
        var sub = await _subs.FindByOrganizationAsync(cmd.OrganizationId, ct);
        if (sub is null || !sub.IsActive) return new PlanLimitCheckResult(true, null, null, null, null);
        var plan = await _plans.FindByIdAsync(sub.PlanId, ct);
        if (plan is null) return new PlanLimitCheckResult(true, null, null, null, null);

        int current = cmd.Kind switch
        {
            PlanLimitKind.ActiveEvents => (await _events.ListAsync(cmd.OrganizationId, null, 0, int.MaxValue, ct))
                .Count(e => e.Status == Domain.EventManagement.ValueObjects.EventStatus.Published),
            PlanLimitKind.AttendeesThisMonth => await CountAttendeesThisMonth(cmd.OrganizationId, ct),
            PlanLimitKind.StaffSeats => 0,  // Phase 6: count Membership
            _ => 0,
        };
        int limit = cmd.Kind switch
        {
            PlanLimitKind.ActiveEvents => plan.MaxActiveEvents,
            PlanLimitKind.AttendeesThisMonth => plan.MaxAttendeesPerMonth,
            PlanLimitKind.StaffSeats => plan.MaxStaffSeats,
            _ => int.MaxValue,
        };

        if (current + cmd.RequestedDelta > limit)
        {
            return new PlanLimitCheckResult(
                false,
                "plan_limit_exceeded",
                $"{cmd.Kind} limit reached ({current}/{limit})",
                limit,
                current);
        }
        return new PlanLimitCheckResult(true, null, null, limit, current);
    }

    private async Task<int> CountAttendeesThisMonth(Guid orgId, CancellationToken ct)
    {
        var startOfMonth = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var events = await _events.ListAsync(orgId, null, 0, int.MaxValue, ct);
        var total = 0;
        foreach (var e in events)
        {
            var regs = await _registrations.ListByEventAsync(e.Id.Value, orgId, 0, int.MaxValue, ct);
            total += regs.Count(r => r.IssuedAt >= startOfMonth);
        }
        return total;
    }
}
