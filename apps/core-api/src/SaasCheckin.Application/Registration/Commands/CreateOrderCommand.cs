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

public sealed class CreateOrderCommandHandler
    : IRequestHandler<CreateOrderCommand, CreateOrderResult>
{
    private static readonly TimeSpan PendingTimeout = TimeSpan.FromMinutes(10);

    private readonly IOrderRepository _orders;
    private readonly ITicketTypeRepository _tickets;
    private readonly IPricingService _pricing;
    private readonly IClock _clock;

    public CreateOrderCommandHandler(
        IOrderRepository orders,
        ITicketTypeRepository tickets,
        IPricingService pricing,
        IClock clock)
    {
        _orders = orders;
        _tickets = tickets;
        _pricing = pricing;
        _clock = clock;
    }

    public async Task<CreateOrderResult> Handle(CreateOrderCommand cmd, CancellationToken ct)
    {
        var tt = await _tickets.FindByIdAsync(TicketTypeId.From(cmd.TicketTypeId), cmd.OrganizationId, ct)
                 ?? throw new InvalidOperationException("TicketType not found");

        var quote = _pricing.Quote(tt, cmd.Quantity, cmd.DiscountCode, _clock.UtcNow);
        if (!quote.IsValid) throw new InvalidOperationException(quote.FailureReason);

        tt.ReserveSeats(cmd.Quantity, _clock);

        var order = Order.Create(
            cmd.OrganizationId, cmd.EventId, cmd.TicketTypeId, cmd.Quantity,
            cmd.BuyerEmail, cmd.BuyerName,
            quote.Subtotal, quote.Discount, quote.Total,
            quote.AppliedDiscountCode, cmd.Provider, PendingTimeout, _clock);

        await _orders.AddAsync(order, ct);
        await _tickets.UpdateAsync(tt, ct);

        return new CreateOrderResult(
            order.Id, cmd.TicketTypeId, cmd.Quantity,
            quote.Subtotal, quote.Discount, quote.Total,
            quote.AppliedDiscountCode, order.ExpiresAt);
    }
}
