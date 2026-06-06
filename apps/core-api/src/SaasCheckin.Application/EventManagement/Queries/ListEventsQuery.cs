using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Application.EventManagement.Queries;

public sealed record ListEventsQuery(
    Guid OrganizationId,
    EventStatus? Status,
    int Skip,
    int Take) : IRequest<IReadOnlyList<Event>>;

public sealed class ListEventsQueryHandler : IRequestHandler<ListEventsQuery, IReadOnlyList<Event>>
{
    private readonly IEventRepository _events;
    public ListEventsQueryHandler(IEventRepository events) => _events = events;

    public Task<IReadOnlyList<Event>> Handle(ListEventsQuery query, CancellationToken ct) =>
        _events.ListAsync(query.OrganizationId, query.Status, query.Skip, query.Take, ct);
}
