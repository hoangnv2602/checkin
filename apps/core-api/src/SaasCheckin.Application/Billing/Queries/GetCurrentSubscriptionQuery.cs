using MediatR;
using SaasCheckin.Domain.Billing.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed record GetCurrentSubscriptionQuery(Guid OrganizationId)
    : IRequest<SubscriptionDto?>;

public sealed record SubscriptionDto(
    Guid Id,
    Guid OrganizationId,
    Guid PlanId,
    string State,
    string CurrentPeriodStart,
    string CurrentPeriodEnd,
    string? TrialEndsAt,
    string? CancelledAt,
    string? ExternalSubscriptionId);
