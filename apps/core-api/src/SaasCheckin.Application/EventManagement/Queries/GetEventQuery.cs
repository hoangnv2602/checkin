using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Application.EventManagement.Queries;

public sealed record GetEventQuery(
    Guid OrganizationId,
    Guid EventId) : IRequest<Event?>;
