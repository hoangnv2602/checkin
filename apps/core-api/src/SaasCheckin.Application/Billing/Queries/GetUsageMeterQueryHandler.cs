using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed class GetUsageMeterQueryHandler
    : IRequestHandler<GetUsageMeterQuery, UsageMeterDto>
{
    private readonly ISubscriptionRepository _subs;
    private readonly IPlanRepository _plans;
    private readonly IEventRepository _events;
    private readonly IRegistrationRepository _registrations;

    public GetUsageMeterQueryHandler(
        ISubscriptionRepository subs,
        IPlanRepository plans,
        IEventRepository events,
        IRegistrationRepository registrations)
    {
        _subs = subs;
        _plans = plans;
        _events = events;
        _registrations = registrations;
    }

    public async Task<UsageMeterDto> Handle(GetUsageMeterQuery q, CancellationToken ct)
    {
        var sub = await _subs.FindByOrganizationAsync(q.OrganizationId, ct);
        var plan = sub is null ? null : await _plans.FindByIdAsync(sub.PlanId, ct);
        var maxEvents = plan?.MaxActiveEvents ?? 1;
        var maxAttendees = plan?.MaxAttendeesPerMonth ?? 50;
        var maxSeats = plan?.MaxStaffSeats ?? 3;

        var events = await _events.ListAsync(q.OrganizationId, null, 0, int.MaxValue, ct);
        var activeEvents = events.Count(e => e.Status == Domain.EventManagement.ValueObjects.EventStatus.Published);

        var startOfMonth = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var totalAttendees = 0;
        foreach (var e in events)
        {
            var regs = await _registrations.ListByEventAsync(e.Id.Value, q.OrganizationId, 0, int.MaxValue, ct);
            totalAttendees += regs.Count(r => r.IssuedAt >= startOfMonth);
        }

        return new UsageMeterDto(
            activeEvents,
            totalAttendees,
            0,  // Phase 6: count Membership for staff seats
            maxEvents,
            maxAttendees,
            maxSeats);
    }
}
