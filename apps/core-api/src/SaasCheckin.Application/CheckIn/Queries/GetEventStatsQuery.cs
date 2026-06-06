using MediatR;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.CheckIn.Queries;

public sealed record GetEventStatsQuery(Guid OrganizationId, Guid EventId) : IRequest<EventStatsResult>;

public sealed record EventStatsResult(
    Guid EventId,
    int TotalRegistrations,
    int CheckedIn,
    int Rejected,
    int Duplicates,
    double CheckInPercent);

public sealed class GetEventStatsQueryHandler : IRequestHandler<GetEventStatsQuery, EventStatsResult>
{
    private readonly ICheckInRecordRepository _records;
    private readonly IRegistrationRepository _registrations;
    private readonly SaasCheckin.Application.CheckIn.Commands.ICheckInCache _cache;

    public GetEventStatsQueryHandler(
        ICheckInRecordRepository records,
        IRegistrationRepository registrations,
        SaasCheckin.Application.CheckIn.Commands.ICheckInCache cache)
    {
        _records = records;
        _registrations = registrations;
        _cache = cache;
    }

    public async Task<EventStatsResult> Handle(GetEventStatsQuery q, CancellationToken ct)
    {
        // Cached count preferred
        var cached = await _cache.GetCheckInCountAsync(q.EventId, q.OrganizationId, ct);
        var checkedIn = cached ?? await _records.CountSuccessByEventAsync(q.EventId, q.OrganizationId, ct);
        var total = (await _registrations.ListByEventAsync(q.EventId, q.OrganizationId, 0, 1, ct)).Count;
        var totalAll = (await _registrations.ListByEventAsync(q.EventId, q.OrganizationId, 0, int.MaxValue, ct)).Count;
        var rejected = await _records.CountRejectedByEventAsync(q.EventId, q.OrganizationId, ct);
        var percent = totalAll > 0 ? Math.Round(100.0 * checkedIn / totalAll, 2) : 0;
        return new EventStatsResult(q.EventId, totalAll, checkedIn, rejected, 0, percent);
    }
}
