import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";

/**
 * EventsModule — Phase 0 skeleton.
 */
@Module({
  controllers: [EventsController],
})
export class EventsModule {}
