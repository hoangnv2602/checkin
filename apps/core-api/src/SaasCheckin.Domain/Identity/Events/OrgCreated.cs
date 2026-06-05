using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// Domain event: Organization vừa được tạo. In-process qua MediatR
/// (cập nhật search index, gửi welcome email, tạo default settings).
/// </summary>
public sealed record OrgCreated(
    OrganizationId OrganizationId,
    string Name,
    OrgSlug Slug,
    DateTimeOffset OccurredAt
) : IDomainEvent;
