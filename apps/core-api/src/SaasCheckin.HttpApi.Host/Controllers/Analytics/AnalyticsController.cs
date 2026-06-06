using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.Analytics.Queries;

namespace SaasCheckin.HttpApi.Host.Controllers.Analytics;

[ApiController]
[Route("v1/analytics")]
public sealed class AnalyticsController : ControllerBase
{
    private readonly IMediator _mediator;
    public AnalyticsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("events/{eventId:guid}/report")]
    public async Task<IActionResult> GetReport(Guid eventId, [FromQuery] Guid organizationId, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetEventStatsReportQuery(organizationId, eventId), ct);
        return Ok(result);
    }

    [HttpGet("events/{eventId:guid}/export")]
    public async Task<IActionResult> ExportCsv(Guid eventId, [FromQuery] Guid organizationId, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetEventStatsReportQuery(organizationId, eventId), ct);
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("metric,value");
        sb.AppendLine($"total_registered,{result.TotalRegistered}");
        sb.AppendLine($"total_checked_in,{result.TotalCheckedIn}");
        sb.AppendLine($"no_show_percent,{result.NoShowPercent}");
        sb.AppendLine($"avg_check_in_minutes,{result.AvgCheckInMinutes}");
        sb.AppendLine($"p50_check_in_minutes,{result.P50CheckInMinutes}");
        sb.AppendLine($"p95_check_in_minutes,{result.P95CheckInMinutes}");
        sb.AppendLine($"peak_gate,{result.PeakGate}");
        sb.AppendLine($"peak_time,{result.PeakTime?.ToString("O") ?? ""}");
        sb.AppendLine();
        sb.AppendLine("ticket_type,registered,attended,attendance_percent");
        foreach (var c in result.Cohorts)
        {
            sb.AppendLine($"{c.TicketTypeName},{c.Registered},{c.Attended},{c.AttendancePercent}");
        }
        var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"event-{eventId}-report-{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}
