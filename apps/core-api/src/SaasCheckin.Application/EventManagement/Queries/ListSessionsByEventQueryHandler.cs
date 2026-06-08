using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Application.EventManagement.Queries;

public sealed class ListSessionsByEventQueryHandler
    : IRequestHandler<ListSessionsByEventQuery, IReadOnlyList<Session>>
{
    private readonly ISessionRepository _sessions;
    public ListSessionsByEventQueryHandler(ISessionRepository sessions) => _sessions = sessions;

    public Task<IReadOnlyList<Session>> Handle(ListSessionsByEventQuery query, CancellationToken ct) =>
        _sessions.ListByEventAsync(
            query.OrganizationId, EventId.From(query.EventId), query.Skip, query.Take, ct);
}
