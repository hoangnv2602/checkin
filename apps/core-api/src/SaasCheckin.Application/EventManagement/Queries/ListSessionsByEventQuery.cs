using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Application.EventManagement.Queries;

public sealed record ListSessionsByEventQuery(
    Guid OrganizationId,
    Guid EventId,
    int Skip,
    int Take) : IRequest<IReadOnlyList<Session>>;
