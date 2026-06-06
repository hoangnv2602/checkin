import { Module } from "@nestjs/common";
import { RedisModule } from "../_shared/redis/redis.module";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

/**
 * EventsModule — I-202.
 * Provides EventsService (Redis cache + core-api bridge) and exposes
 * EventsController at /v1/events. JwtAuthGuard is global, nên mọi route ở đây
 * yêu cầu Bearer token trừ khi decorated @Public().
 */
@Module({
  imports: [RedisModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
