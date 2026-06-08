using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// CreateOrder — public endpoint: attendee submit form, tạo Order pending
/// với quote tính bởi IPricingService. ReserveSeat được gọi trên TicketType.
/// Return OrderId + provider session sau khi attach (BFF gọi PaymentProvider
/// để tạo session Stripe / VNPay, set qua AttachProviderSessionCommand).
/// </summary>
public sealed record CreateOrderCommand(
    Guid OrganizationId,
    Guid EventId,
    Guid TicketTypeId,
    int Quantity,
    string BuyerEmail,
    string BuyerName,
    string? DiscountCode,
    PaymentProvider Provider) : IRequest<CreateOrderResult>;

public sealed record CreateOrderResult(
    OrderId OrderId,
    Guid TicketTypeId,
    int Quantity,
    Money Subtotal,
    Money Discount,
    Money Total,
    string? DiscountCode,
    DateTimeOffset ExpiresAt);
