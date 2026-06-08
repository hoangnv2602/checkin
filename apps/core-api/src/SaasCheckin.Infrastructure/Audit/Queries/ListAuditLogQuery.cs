// apps/core-api/src/SaasCheckin.Infrastructure/Audit/Queries/ListAuditLogQuery.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.Audit;

namespace SaasCheckin.Infrastructure.Audit.Queries;

public sealed record ListAuditLogQuery(
    Guid OrganizationId,
    Guid? ActorUserId = null,
    string? Action = null,
    string? EntityType = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    int Skip = 0,
    int Take = 50) : IRequest<AuditLogPage>;

public sealed record AuditLogPage(IReadOnlyList<AuditLogEntry> Entries, int Total);

public sealed record AuditLogEntry(
    Guid Id,
    Guid ActorUserId,
    string ActorRole,
    string Action,
    string EntityType,
    string EntityId,
    DateTimeOffset OccurredAt,
    string? IpAddress);
