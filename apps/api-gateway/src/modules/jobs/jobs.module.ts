import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";

/**
 * JobsModule — Phase 0 skeleton.
 */
@Module({
  controllers: [JobsController],
})
export class JobsModule {}
