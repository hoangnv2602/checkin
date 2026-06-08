using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Registration.Commands;

public sealed class CreateTicketTypeCommandHandler
    : IRequestHandler<CreateTicketTypeCommand, TicketTypeId>
{
    private readonly ITicketTypeRepository _repo;
    private readonly IClock _clock;

    public CreateTicketTypeCommandHandler(ITicketTypeRepository repo, IClock clock)
    {
        _repo = repo;
        _clock = clock;
    }

    public async Task<TicketTypeId> Handle(CreateTicketTypeCommand cmd, CancellationToken ct)
    {
        var price = Money.Of(cmd.PriceAmountMinor, cmd.PriceCurrency);
        var tt = TicketType.Create(
            cmd.OrganizationId, cmd.EventId, cmd.Name, cmd.Description,
            price, cmd.Capacity, cmd.SaleStartsAt, cmd.SaleEndsAt, _clock);
        await _repo.AddAsync(tt, ct);
        return tt.Id;
    }
}
