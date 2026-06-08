using MediatR;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.Services;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Billing.Commands;

/// <summary>
/// CheckPlanLimitCommand — Phase 5 I-502: BFF gọi trước khi mutate (CreateEvent,
/// RegisterAttendee, InviteMember) để check usage vs plan limit. Cache ở BFF
/// Redis 5 phút; invalidate khi subscription đổi.
/// </summary>
public sealed record CheckPlanLimitCommand(
    Guid OrganizationId,
    PlanLimitKind Kind,
    int RequestedDelta = 1) : IRequest<PlanLimitCheckResult>;

public sealed record PlanLimitCheckResult(
    bool Allowed,
    string? Code,
    string? Message,
    int? Limit,
    int? Current);

public enum PlanLimitKind { ActiveEvents, AttendeesThisMonth, StaffSeats }
