using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public enum VenueAction { Activate, Deactivate, Archive }

public sealed record ChangeVenueStatusCommand(
    Guid OrganizationId,
    Guid VenueId,
    VenueAction Action) : IRequest<Unit>;
