using MediatR;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

public sealed record SubscribeToPlanCommand(
    Guid OrganizationId,
    PlanId PlanId,
    bool StartTrial,
    string? ExternalSubscriptionId) : IRequest<SubscriptionId>;
