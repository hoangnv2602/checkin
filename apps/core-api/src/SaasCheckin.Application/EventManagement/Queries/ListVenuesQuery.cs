using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Application.EventManagement.Queries;

public sealed record ListVenuesQuery(
    Guid OrganizationId,
    VenueStatus? Status,
    int Skip,
    int Take) : IRequest<IReadOnlyList<Venue>>;

public sealed class ListVenuesQueryHandler : IRequestHandler<ListVenuesQuery, IReadOnlyList<Venue>>
{
    private readonly IVenueRepository _venues;
    public ListVenuesQueryHandler(IVenueRepository venues) => _venues = venues;

    public Task<IReadOnlyList<Venue>> Handle(ListVenuesQuery query, CancellationToken ct) =>
        _venues.ListAsync(query.OrganizationId, query.Status, query.Skip, query.Take, ct);
}
