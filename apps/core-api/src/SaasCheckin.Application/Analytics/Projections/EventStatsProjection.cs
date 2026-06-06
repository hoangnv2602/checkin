/**
 * apps/core-api/src/SaasCheckin.Application/Analytics/Projections/EventStatsProjection.cs
 *
 * I-601 — Read-model projection từ domain events. Sub handler update
 * bảng event_stats_read_model (denormalized) để query p95 < 100ms cho
 * dashboard 10k registration.
 */
using MediatR;
using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.CheckIn.Events;
using SaasCheckin.Domain.Registration.Events;
using SaasCheckin.EntityFrameworkCore;

namespace SaasCheckin.Application.Analytics.Projections;

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

public sealed class TicketIssuedProjectionHandler
    : INotificationHandler<TicketIssuedIntegrationEvent>
{
    private readonly SaasCheckinDbContext _db;
    public TicketIssuedProjectionHandler(SaasCheckinDbContext db) => _db = db;

    public async Task Handle(TicketIssuedIntegrationEvent evt, CancellationToken ct)
    {
        var stats = await _db.Set<EventStatsReadModel>()
            .FirstOrDefaultAsync(s => s.EventId == evt.EventId, ct);
        if (stats is null)
        {
            stats = new EventStatsReadModel
            {
                EventId = evt.EventId,
                OrganizationId = evt.OrganizationId,
                TotalRegistrations = 0,
                CheckedIn = 0,
                UpdatedAt = DateTimeOffset.UtcNow,
            };
            _db.Set<EventStatsReadModel>().Add(stats);
        }
        stats.TotalRegistrations += 1;
        stats.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

public sealed class AttendeeCheckedInProjectionHandler
    : INotificationHandler<AttendeeCheckedInIntegrationEvent>
{
    private readonly SaasCheckinDbContext _db;
    public AttendeeCheckedInProjectionHandler(SaasCheckinDbContext db) => _db = db;

    public async Task Handle(AttendeeCheckedInIntegrationEvent evt, CancellationToken ct)
    {
        var stats = await _db.Set<EventStatsReadModel>()
            .FirstOrDefaultAsync(s => s.EventId == evt.EventId, ct);
        if (stats is null) return;  // shouldn't happen — TicketIssued tạo trước
        stats.CheckedIn += 1;
        stats.LastCheckInAt = evt.ScannedAt;
        if (!stats.FirstCheckInAt.HasValue) stats.FirstCheckInAt = evt.ScannedAt;
        stats.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
