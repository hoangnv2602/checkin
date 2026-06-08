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
