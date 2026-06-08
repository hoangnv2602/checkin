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
