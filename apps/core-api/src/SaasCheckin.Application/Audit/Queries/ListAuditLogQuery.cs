/**
 * apps/core-api/src/SaasCheckin.Application/Audit/Queries/ListAuditLogQuery.cs
 */
using MediatR;
using Microsoft.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.Audit;

namespace SaasCheckin.Application.Audit.Queries;

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

public sealed class ListAuditLogQueryHandler : IRequestHandler<ListAuditLogQuery, AuditLogPage>
{
    private readonly SaasCheckinDbContext _db;
    public ListAuditLogQueryHandler(SaasCheckinDbContext db) => _db = db;

    public async Task<AuditLogPage> Handle(ListAuditLogQuery q, CancellationToken ct)
    {
        var query = _db.Set<AuditLogEntityConfiguration.AuditLogEntity>()
            .AsNoTracking()
            .Where(a => a.TenantId == q.OrganizationId);

        if (q.ActorUserId.HasValue) query = query.Where(a => a.ActorUserId == q.ActorUserId);
        if (!string.IsNullOrEmpty(q.Action)) query = query.Where(a => a.Action == q.Action);
        if (!string.IsNullOrEmpty(q.EntityType)) query = query.Where(a => a.EntityType == q.EntityType);
        if (q.From.HasValue) query = query.Where(a => a.OccurredAt >= q.From);
        if (q.To.HasValue) query = query.Where(a => a.OccurredAt <= q.To);

        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(a => a.OccurredAt)
            .Skip(q.Skip).Take(q.Take)
            .ToListAsync(ct);

        var entries = rows.Select(r => new AuditLogEntry(
            r.Id, r.ActorUserId, r.ActorRole, r.Action, r.EntityType, r.EntityId,
            r.OccurredAt, r.IpAddress)).ToList();
        return new AuditLogPage(entries, total);
    }
}
