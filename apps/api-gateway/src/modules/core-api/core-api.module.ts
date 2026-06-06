import { Module } from "@nestjs/common";
import { CoreApiController } from "./core-api.controller";
import { CoreApiService } from "./core-api.service";

/**
 * CoreApiModule — Phase 3 wiring.
 * Exposes CoreApiService (gRPC + REST bridge to core-api for misc queries)
 * và CoreApiController stub.
 */
@Module({
  controllers: [CoreApiController],
  providers: [CoreApiService],
  exports: [CoreApiService],
})
export class CoreApiModule {}
