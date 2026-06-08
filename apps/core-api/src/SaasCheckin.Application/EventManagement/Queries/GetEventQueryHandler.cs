using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Application.EventManagement.Queries;

public sealed class GetEventQueryHandler : IRequestHandler<GetEventQuery, Event?>
{
    private readonly IEventRepository _events;
    public GetEventQueryHandler(IEventRepository events) => _events = events;

    public Task<Event?> Handle(GetEventQuery query, CancellationToken ct) =>
        _events.FindByIdAsync(EventId.From(query.EventId), query.OrganizationId, ct);
}
