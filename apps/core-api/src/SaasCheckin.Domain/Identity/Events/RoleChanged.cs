using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// Domain event: Membership role thay đổi. In-process qua MediatR
/// (invalidate JWT cache, gửi email thông báo, audit log).
/// </summary>
public sealed record RoleChanged(
    MembershipId MembershipId,
    UserId UserId,
    OrganizationId OrganizationId,
    string OldRole,
    string NewRole,
    DateTimeOffset OccurredAt
) : IDomainEvent;
