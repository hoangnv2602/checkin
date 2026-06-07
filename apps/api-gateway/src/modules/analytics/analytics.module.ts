/**
 * apps/api-gateway/src/modules/analytics/analytics.module.ts
 *
 * I-601 — Wires AnalyticsController + AnalyticsService.
 */
import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
