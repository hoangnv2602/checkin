using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record UpdateSessionCommand(
    Guid OrganizationId,
    Guid SessionId,
    string? Title,
    string? Description,
    DateTimeOffset? StartAt,
    DateTimeOffset? EndAt,
    int? Capacity,
    Guid? VenueId,
    bool ClearVenue) : IRequest<Unit>;
