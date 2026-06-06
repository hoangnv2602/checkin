import { Module } from "@nestjs/common";
import { RedisModule } from "../_shared/redis/redis.module";
import { EventsController, VenuesController } from "./events.controller";
import { EventsService } from "./events.service";

/**
 * EventsModule — I-202 + I-201 wiring.
 * Provides EventsService (Redis cache + gRPC bridge to core-api) and exposes
 * EventsController (/v1/events, /v1/events/:id/sessions) + VenuesController
 * (/v1/venues). JwtAuthGuard is global, nên mọi route ở đây yêu cầu Bearer
 * token trừ khi decorated @Public().
 */
@Module({
  imports: [RedisModule],
  controllers: [EventsController, VenuesController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
