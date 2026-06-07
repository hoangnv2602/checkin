import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { RedisModule } from "../_shared/redis/redis.module";
import { EventsController, VenuesController } from "./events.controller";
import { EventsService } from "./events.service";
import { PlanLimitsModule } from "../billing/plan-limits/plan-limits.module";
import { PlanLimitGuard } from "../billing/plan-limits/plan-limit.guard";

/**
 * EventsModule — I-202 + I-201 wiring.
 * Provides EventsService (Redis cache + gRPC bridge to core-api) and exposes
 * EventsController (/v1/events, /v1/events/:id/sessions) + VenuesController
 * (/v1/venues). JwtAuthGuard is global, nên mọi route ở đây yêu cầu Bearer
 * token trừ khi decorated @Public(). PlanLimitGuard is global too — opt-out
 * via không gắn @PlanLimit().
 */
@Module({
  imports: [RedisModule, PlanLimitsModule],
  controllers: [EventsController, VenuesController],
  providers: [
    EventsService,
    {
      provide: APP_GUARD,
      useClass: PlanLimitGuard,
    },
  ],
  exports: [EventsService],
})
export class EventsModule {}
