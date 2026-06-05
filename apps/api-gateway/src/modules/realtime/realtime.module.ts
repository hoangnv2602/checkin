import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller";

/**
 * RealtimeModule — Phase 0 skeleton.
 */
@Module({
  controllers: [RealtimeController],
})
export class RealtimeModule {}
