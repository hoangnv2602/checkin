using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record UpdateVenueCommand(
    Guid OrganizationId,
    Guid VenueId,
    string? Name,
    string? Description,
    string? Country,
    string? StreetLine1,
    string? StreetLine2,
    string? City,
    string? Region,
    string? PostalCode,
    int? Capacity,
    double? Latitude,
    double? Longitude,
    bool ClearGeo) : IRequest<Unit>;
