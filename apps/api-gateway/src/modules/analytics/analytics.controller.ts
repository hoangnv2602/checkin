/**
 * apps/api-gateway/src/modules/analytics/analytics.controller.ts
 *
 * I-601 — Owner/Admin/Organizer read event stats + export CSV.
 * Routes:
 *   GET /v1/analytics/events/:eventId/report → JSON
 *   GET /v1/analytics/events/:eventId/export → CSV download
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { VerifiedAuth } from "../auth/services/jwt-verifier.service";
import { AnalyticsService, type EventStatsReportDto } from "./analytics.service";

@ApiTags("analytics")
@Controller("v1/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("events/:eventId/report")
  @ApiOperation({ summary: "Get event stats report (counts, percentiles, cohorts)" })
  async getReport(
    @CurrentUser() user: VerifiedAuth,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
  ): Promise<EventStatsReportDto> {
    return this.analytics.getEventReport(this.orgIdOrThrow(user), eventId);
  }

  @Get("events/:eventId/export")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Download event stats as CSV" })
  async exportCsv(
    @CurrentUser() user: VerifiedAuth,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.analytics.getEventReportCsv(this.orgIdOrThrow(user), eventId);
    res.setHeader("Content-Type", csv.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
    res.send(csv.bytes);
  }

  private orgIdOrThrow(user: VerifiedAuth | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException("Missing tenant claim in JWT");
    }
    return user.tenantId;
  }
}
