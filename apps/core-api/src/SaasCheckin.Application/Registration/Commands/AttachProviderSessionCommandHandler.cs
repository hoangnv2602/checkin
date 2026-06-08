using MediatR;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

public sealed class AttachProviderSessionCommandHandler
    : IRequestHandler<AttachProviderSessionCommand>
{
    private readonly IOrderRepository _orders;
    private readonly IClock _clock;

    public AttachProviderSessionCommandHandler(IOrderRepository orders, IClock clock)
    {
        _orders = orders;
        _clock = clock;
    }

    public async Task Handle(AttachProviderSessionCommand cmd, CancellationToken ct)
    {
        var order = await _orders.FindByIdAsync(
            Domain.Registration.ValueObjects.OrderId.From(cmd.OrderId),
            cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException("Order not found");
        order.AttachProviderSession(cmd.ProviderSessionId, _clock);
        await _orders.UpdateAsync(order, ct);
    }
}
