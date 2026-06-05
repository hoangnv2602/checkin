using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// Domain event: User được mời vào Organization. In-process qua MediatR
/// (gửi invitation email, sync search index, ...).
/// </summary>
public sealed record UserInvited(
    MembershipId MembershipId,
    UserId UserId,
    OrganizationId OrganizationId,
    string Role,
    DateTimeOffset OccurredAt
) : IDomainEvent;
