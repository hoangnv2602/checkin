using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Application.Registration.Queries;

public sealed record GetTicketTypeQuery(
    Guid OrganizationId,
    Guid TicketTypeId) : IRequest<TicketType?>;

public sealed class GetTicketTypeQueryHandler
    : IRequestHandler<GetTicketTypeQuery, TicketType?>
{
    private readonly ITicketTypeRepository _repo;
    public GetTicketTypeQueryHandler(ITicketTypeRepository repo) => _repo = repo;

    public Task<TicketType?> Handle(GetTicketTypeQuery query, CancellationToken ct) =>
        _repo.FindByIdAsync(TicketTypeId.From(query.TicketTypeId), query.OrganizationId, ct);
}
