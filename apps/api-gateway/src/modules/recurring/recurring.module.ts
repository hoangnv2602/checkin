/**
 * apps/api-gateway/src/modules/recurring/recurring.module.ts
 *
 * I-904 — Module composition: EventSeriesService + InMemoryEventSeriesStore.
 *
 * Phase 9 ships without a controller (service is consumed by integration tests
 * and Phase 10 migration to Postgres will introduce the HTTP surface). The
 * module exists so the providers are registered with Nest and any future
 * controller can `imports: [RecurringModule]`.
 */
import { Module } from "@nestjs/common";
import { InMemoryEventSeriesStore } from "./event-series.service";
import { EventSeriesService } from "./event-series.service";

@Module({
  providers: [InMemoryEventSeriesStore, EventSeriesService],
  exports: [EventSeriesService, InMemoryEventSeriesStore],
})
export class RecurringModule {}
