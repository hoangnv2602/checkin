using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// MarkOrderPaidCommand — BFF gọi sau khi nhận webhook "payment_succeeded"
/// từ Stripe / VNPay. Aggregate transition Pending → Paid + raise event.
/// Tạo kèm <c>OrderPaidIntegrationEvent</c> để Notification context gửi email.
/// </summary>
public sealed record MarkOrderPaidCommand(
    Guid OrganizationId,
    Guid OrderId,
    string ProviderSessionId) : IRequest;

public sealed class MarkOrderPaidCommandHandler
    : IRequestHandler<MarkOrderPaidCommand>
{
    private static readonly TimeSpan TicketValidity = TimeSpan.FromDays(1);

    private readonly IOrderRepository _orders;
    private readonly ITicketTypeRepository _tickets;
    private readonly IRegistrationRepository _registrations;
    private readonly IIntegrationEventBus _bus;
    private readonly IClock _clock;

    public MarkOrderPaidCommandHandler(
        IOrderRepository orders,
        ITicketTypeRepository tickets,
        IRegistrationRepository registrations,
        IIntegrationEventBus bus,
        IClock clock)
    {
        _orders = orders;
        _tickets = tickets;
        _registrations = registrations;
        _bus = bus;
        _clock = clock;
    }

    public async Task Handle(MarkOrderPaidCommand cmd, CancellationToken ct)
    {
        var order = await _orders.FindByIdAsync(
            Domain.Registration.ValueObjects.OrderId.From(cmd.OrderId),
            cmd.OrganizationId, ct) ?? throw new InvalidOperationException("Order not found");

        order.MarkPaid(cmd.ProviderSessionId, _clock);
        await _orders.UpdateAsync(order, ct);

        // Issue N registrations
        var issued = new List<Domain.Registration.ValueObjects.RegistrationId>();
        for (var i = 0; i < order.Quantity; i++)
        {
            var reg = Registration.Issue(
                order.OrganizationId, order.EventId, order.Id, order.TicketTypeId,
                order.BuyerEmail, $"{order.BuyerName} #{i + 1}", null,
                TicketValidity, _clock);
            await _registrations.AddAsync(reg, ct);
            issued.Add(reg.Id);
            await _bus.PublishAsync(new Domain.Registration.Events.TicketIssuedIntegrationEvent(
                reg.Id, reg.Jti, reg.OrganizationId, reg.EventId, reg.OrderId,
                reg.AttendeeEmail, reg.AttendeeName, reg.AttendeePhone,
                reg.IssuedAt, reg.ExpiresAt, _clock.UtcNow), ct);
        }

        await _bus.PublishAsync(new Domain.Registration.Events.OrderPaidIntegrationEvent(
            order.Id, order.OrganizationId, order.EventId,
            order.BuyerEmail, order.BuyerName, order.Total.AmountMinor, order.Total.Currency,
            order.Provider.ToString(), _clock.UtcNow), ct);
    }
}
