using MediatR;
using SaasCheckin.Domain.Billing.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed class ListPlansQueryHandler : IRequestHandler<ListPlansQuery, IReadOnlyList<PlanDto>>
{
    private readonly IPlanRepository _plans;
    public ListPlansQueryHandler(IPlanRepository plans) => _plans = plans;

    public async Task<IReadOnlyList<PlanDto>> Handle(ListPlansQuery q, CancellationToken ct)
    {
        var plans = await _plans.ListAsync(ct);
        return plans.Select(p => new PlanDto(
            p.Id.Value,
            p.Name,
            p.Tier.ToString(),
            p.Price.AmountMinor,
            p.Price.Currency,
            p.Period.ToString(),
            p.MaxActiveEvents,
            p.MaxAttendeesPerMonth,
            p.MaxStaffSeats,
            p.IsDefault)).ToList();
    }
}
