using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Registration.Queries;

public sealed record ListTicketTypesQuery(
    Guid OrganizationId,
    Guid EventId) : IRequest<IReadOnlyList<TicketType>>;
