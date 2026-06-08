using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record CreateEventCommand(
    Guid OrganizationId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity) : IRequest<EventId>;
