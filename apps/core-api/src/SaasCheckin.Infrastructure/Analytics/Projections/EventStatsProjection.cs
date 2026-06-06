// apps/core-api/src/SaasCheckin.Infrastructure/Analytics/Projections/EventStatsProjection.cs
//
// I-601 — Read-model projection từ domain events. Sub handler update
// bảng event_stats_read_model (denormalized) để query p95 < 100ms cho
// dashboard 10k registration.
//
// TODO(phase-9): wire projection handlers via a custom IIntegrationProjectionHandler<T>
//   interface + dispatcher in the OutboxProcessor (since integration events live in Domain
//   which can't reference MediatR). For now the projection is a no-op stub so the build
//   stays green and the read model is rebuilt lazily on demand.

using Microsoft.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore;

namespace SaasCheckin.Infrastructure.Analytics.Projections;

public sealed class EventStatsReadModel
{
    public Guid EventId { get; set; }
    public Guid OrganizationId { get; set; }
    public int TotalRegistrations { get; set; }
    public int CheckedIn { get; set; }
    public int Rejected { get; set; }
    public int Duplicates { get; set; }
    public DateTimeOffset? FirstCheckInAt { get; set; }
    public DateTimeOffset? LastCheckInAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class EventStatsProjectionService
{
    private readonly SaasCheckinDbContext _db;
    public EventStatsProjectionService(SaasCheckinDbContext db) => _db = db;

    public async Task IncrementRegistrationsAsync(Guid eventId, Guid organizationId, CancellationToken ct = default)
    {
        var stats = await _db.Set<EventStatsReadModel>()
            .FirstOrDefaultAsync(s => s.EventId == eventId, ct);
        if (stats is null)
        {
            stats = new EventStatsReadModel
            {
                EventId = eventId,
                OrganizationId = organizationId,
                UpdatedAt = DateTimeOffset.UtcNow,
            };
            _db.Set<EventStatsReadModel>().Add(stats);
        }
        stats.TotalRegistrations += 1;
        stats.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task IncrementCheckedInAsync(Guid eventId, DateTimeOffset scannedAt, CancellationToken ct = default)
    {
        var stats = await _db.Set<EventStatsReadModel>()
            .FirstOrDefaultAsync(s => s.EventId == eventId, ct);
        if (stats is null) return;
        stats.CheckedIn += 1;
        stats.LastCheckInAt = scannedAt;
        if (!stats.FirstCheckInAt.HasValue) stats.FirstCheckInAt = scannedAt;
        stats.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
