/**
 * apps/api-gateway/src/modules/analytics/analytics.service.ts
 *
 * I-601 — BFF bridge to core-api analytics read model.
 * Exposes event stats report (counts, percentiles, peak gate/time, cohorts)
 * to web dashboard. CSV export streams from core-api to client.
 */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

export interface TicketTypeCohortDto {
  ticketTypeId: string;
  ticketTypeName: string;
  registered: number;
  attended: number;
  attendancePercent: number;
}

export interface EventStatsReportDto {
  eventId: string;
  totalRegistered: number;
  totalCheckedIn: number;
  noShowPercent: number;
  avgCheckInMinutes: number;
  p50CheckInMinutes: number;
  p95CheckInMinutes: number;
  peakGate: string;
  peakTime: string | null;
  cohorts: TicketTypeCohortDto[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  async getEventReport(organizationId: string, eventId: string): Promise<EventStatsReportDto> {
    const url = `${CORE_API_BASE}/v1/analytics/events/${eventId}/report?organizationId=${encodeURIComponent(organizationId)}`;
    const res = await fetch(url);
    if (res.status === 404) throw new NotFoundException("Event stats not found");
    if (!res.ok) throw new Error(`core-api get event stats failed: ${res.status}`);
    return res.json() as Promise<EventStatsReportDto>;
  }

  /**
   * Stream CSV from core-api. Returns the raw bytes + content-type so the
   * controller can serve it as a file download. We don't parse — pass through.
   */
  async getEventReportCsv(
    organizationId: string,
    eventId: string,
  ): Promise<{ bytes: Buffer; contentType: string; filename: string }> {
    const url = `${CORE_API_BASE}/v1/analytics/events/${eventId}/export?organizationId=${encodeURIComponent(organizationId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`core-api CSV export failed: ${res.status}`);
    const ab = await res.arrayBuffer();
    const dispo = res.headers.get("content-disposition") ?? "";
    const match = /filename="?([^"]+)"?/.exec(dispo);
    return {
      bytes: Buffer.from(ab),
      contentType: res.headers.get("content-type") ?? "text/csv",
      filename: match?.[1] ?? `event-${eventId}-report.csv`,
    };
  }
}
