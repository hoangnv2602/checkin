using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// CreateTicketType — organizer tạo loại vé mới cho event đã publish.
/// </summary>
public sealed record CreateTicketTypeCommand(
    Guid OrganizationId,
    Guid EventId,
    string Name,
    string? Description,
    long PriceAmountMinor,
    string PriceCurrency,
    int Capacity,
    DateTimeOffset SaleStartsAt,
    DateTimeOffset SaleEndsAt) : IRequest<TicketTypeId>;
