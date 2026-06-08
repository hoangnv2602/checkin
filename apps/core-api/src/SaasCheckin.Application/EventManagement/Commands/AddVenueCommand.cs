using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record AddVenueCommand(
    Guid OrganizationId,
    string Name,
    string? Description,
    string Country,
    string? StreetLine1,
    string? StreetLine2,
    string? City,
    string? Region,
    string? PostalCode,
    int? Capacity,
    double? Latitude,
    double? Longitude) : IRequest<VenueId>;
