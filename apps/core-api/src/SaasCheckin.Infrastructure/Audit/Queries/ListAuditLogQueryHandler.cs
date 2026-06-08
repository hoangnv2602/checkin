using MediatR;
using Microsoft.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.Audit;

namespace SaasCheckin.Infrastructure.Audit.Queries;

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
