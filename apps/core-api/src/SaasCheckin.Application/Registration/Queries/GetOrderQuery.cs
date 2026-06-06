using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Application.Registration.Queries;

public sealed record GetOrderQuery(
    Guid OrganizationId,
    Guid OrderId) : IRequest<Order?>;

public sealed class GetOrderQueryHandler : IRequestHandler<GetOrderQuery, Order?>
{
    private readonly IOrderRepository _repo;
    public GetOrderQueryHandler(IOrderRepository repo) => _repo = repo;

    public Task<Order?> Handle(GetOrderQuery query, CancellationToken ct) =>
        _repo.FindByIdAsync(OrderId.From(query.OrderId), query.OrganizationId, ct);
}
