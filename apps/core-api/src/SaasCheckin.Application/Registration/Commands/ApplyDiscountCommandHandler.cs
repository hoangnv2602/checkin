using MediatR;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

public sealed class ApplyDiscountCommandHandler
    : IRequestHandler<ApplyDiscountCommand, ApplyDiscountResult>
{
    private readonly ITicketTypeRepository _tickets;
    private readonly Domain.Registration.Services.IPricingService _pricing;
    private readonly IClock _clock;

    public ApplyDiscountCommandHandler(
        ITicketTypeRepository tickets,
        Domain.Registration.Services.IPricingService pricing,
        IClock clock)
    {
        _tickets = tickets;
        _pricing = pricing;
        _clock = clock;
    }

    public async Task<ApplyDiscountResult> Handle(ApplyDiscountCommand cmd, CancellationToken ct)
    {
        var tt = await _tickets.FindByIdAsync(
            Domain.Registration.ValueObjects.TicketTypeId.From(cmd.TicketTypeId),
            cmd.OrganizationId, ct) ?? throw new InvalidOperationException("TicketType not found");

        var quote = _pricing.Quote(tt, cmd.Quantity, cmd.DiscountCode, _clock.UtcNow);
        return new ApplyDiscountResult(
            quote.Subtotal, quote.Discount, quote.Total,
            quote.AppliedDiscountCode, quote.FailureReason);
    }
}
