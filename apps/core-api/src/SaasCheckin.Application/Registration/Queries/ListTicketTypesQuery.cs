using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Registration.Queries;

public sealed record ListTicketTypesQuery(
    Guid OrganizationId,
    Guid EventId) : IRequest<IReadOnlyList<TicketType>>;

public sealed class ListTicketTypesQueryHandler
    : IRequestHandler<ListTicketTypesQuery, IReadOnlyList<TicketType>>
{
    private readonly ITicketTypeRepository _repo;
    public ListTicketTypesQueryHandler(ITicketTypeRepository repo) => _repo = repo;

    public Task<IReadOnlyList<TicketType>> Handle(ListTicketTypesQuery query, CancellationToken ct) =>
        _repo.ListByEventAsync(query.EventId, query.OrganizationId, ct);
}
