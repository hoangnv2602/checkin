using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Application.Registration.Queries;

public sealed record GetOrderQuery(
    Guid OrganizationId,
    Guid OrderId) : IRequest<Order?>;
