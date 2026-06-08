using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record AddSessionCommand(
    Guid OrganizationId,
    Guid EventId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity,
    Guid? VenueId) : IRequest<SessionId>;
