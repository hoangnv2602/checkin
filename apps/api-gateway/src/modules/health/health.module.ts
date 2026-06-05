import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

/**
 * HealthModule — Phase 0 skeleton.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
