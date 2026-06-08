using MediatR;
using SaasCheckin.Domain.Billing.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed record ListPlansQuery() : IRequest<IReadOnlyList<PlanDto>>;

public sealed record PlanDto(
    Guid Id,
    string Name,
    string Tier,
    long PriceAmountMinor,
    string PriceCurrency,
    string Period,
    int MaxActiveEvents,
    int MaxAttendeesPerMonth,
    int MaxStaffSeats,
    bool IsDefault);
