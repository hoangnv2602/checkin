import { Module } from "@nestjs/common";
import { CoreApiController } from "./core-api.controller";

/**
 * CoreApiModule — Phase 0 skeleton.
 */
@Module({
  controllers: [CoreApiController],
})
export class CoreApiModule {}
