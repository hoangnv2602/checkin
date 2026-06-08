using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

public sealed record UpgradePlanCommand(
    Guid OrganizationId,
    PlanId NewPlanId) : IRequest;
