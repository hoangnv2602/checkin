// apps/core-api/src/SaasCheckin.Infrastructure/Analytics/Queries/GetEventStatsReportQuery.cs
//
// I-601 — Reports: total check-in, no-show rate, time-to-checkin (avg, p50, p95),
// peak gate + peak time, cohort (registered vs attended theo ticket type).
using MediatR;
using Microsoft.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.EntityFrameworkCore.CheckIn;
using SaasCheckin.EntityFrameworkCore.Registration;
using SaasCheckin.Infrastructure.Analytics.Projections;

namespace SaasCheckin.Infrastructure.Analytics.Queries;

public sealed record GetEventStatsReportQuery(
    Guid OrganizationId,
    Guid EventId) : IRequest<EventStatsReport>;

public sealed record EventStatsReport(
    Guid EventId,
    int TotalRegistered,
    int TotalCheckedIn,
    double NoShowPercent,
    double AvgCheckInMinutes,
    double P50CheckInMinutes,
    double P95CheckInMinutes,
    string PeakGate,
    DateTimeOffset? PeakTime,
    IReadOnlyList<TicketTypeCohort> Cohorts);

public sealed record TicketTypeCohort(
    Guid TicketTypeId,
    string TicketTypeName,
    int Registered,
    int Attended,
    double AttendancePercent);

public sealed class GetEventStatsReportQueryHandler
    : IRequestHandler<GetEventStatsReportQuery, EventStatsReport>
{
    private readonly SaasCheckinDbContext _db;
    public GetEventStatsReportQueryHandler(SaasCheckinDbContext db) => _db = db;

    public async Task<EventStatsReport> Handle(GetEventStatsReportQuery q, CancellationToken ct)
    {
        var stats = await _db.Set<EventStatsReadModel>()
            .FirstOrDefaultAsync(s => s.EventId == q.EventId && s.OrganizationId == q.OrganizationId, ct);

        // Cohort by ticket type
        var regs = await _db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
            .AsNoTracking()
            .Where(r => r.EventId == q.EventId && r.TenantId == q.OrganizationId)
            .Join(_db.Set<TicketTypeEntityConfiguration.TicketTypeEntity>()
                    .AsNoTracking()
                    .Where(t => t.TenantId == q.OrganizationId),
                r => r.TicketTypeId,
                t => t.Id,
                (r, t) => new { r, t.Name })
            .ToListAsync(ct);

        var cohorts = regs
            .GroupBy(x => x.Name)
            .Select(g => new TicketTypeCohort(
                Guid.Empty,
                g.Key,
                g.Count(),
                g.Count(x => x.r.Status == 1),
                !g.Any() ? 0 : Math.Round(100.0 * g.Count(x => x.r.Status == 1) / g.Count(), 2)
            ))
            .ToList();

        // Check-in time deltas
        var checkIns = await _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>()
            .AsNoTracking()
            .Where(c => c.EventId == q.EventId
                && c.TenantId == q.OrganizationId
                && c.Status == 0)
            .Join(_db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
                    .AsNoTracking(),
                c => c.RegistrationId,
                r => r.Id,
                (c, r) => new { ScannedAt = c.ScannedAt, IssuedAt = r.IssuedAt, GateId = c.GateId })
            .ToListAsync(ct);

        var deltasMin = checkIns
            .Select(x => (x.ScannedAt - x.IssuedAt).TotalMinutes)
            .OrderBy(d => d)
            .ToList();
        var avg = deltasMin.Count > 0 ? deltasMin.Average() : 0;
        var p50 = Percentile(deltasMin, 0.5);
        var p95 = Percentile(deltasMin, 0.95);

        // Peak gate + peak time
        var peakGate = checkIns
            .GroupBy(x => x.GateId)
            .OrderByDescending(g => g.Count())
            .FirstOrDefault()?.Key.ToString() ?? "—";
        var peakTime = checkIns
            .GroupBy(x => new DateTimeOffset(x.ScannedAt.Year, x.ScannedAt.Month, x.ScannedAt.Day, x.ScannedAt.Hour, x.ScannedAt.Minute, 0, x.ScannedAt.Offset))
            .OrderByDescending(g => g.Count())
            .FirstOrDefault()?.Key;

        var total = stats?.TotalRegistrations ?? regs.Count;
        var checkedIn = stats?.CheckedIn ?? checkIns.Count;
        var noShow = total == 0 ? 0 : Math.Round(100.0 * (total - checkedIn) / total, 2);

        return new EventStatsReport(
            q.EventId,
            total,
            checkedIn,
            noShow,
            Math.Round(avg, 2),
            Math.Round(p50, 2),
            Math.Round(p95, 2),
            peakGate,
            peakTime,
            cohorts);
    }

    private static double Percentile(List<double> sorted, double p)
    {
        if (sorted.Count == 0) return 0;
        var idx = (int)Math.Floor((sorted.Count - 1) * p);
        return sorted[idx];
    }
}
