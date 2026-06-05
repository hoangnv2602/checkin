import { Module } from "@nestjs/common";
import { Core-apiController } from "./core-api.controller";

/**
 * Core-apiModule — Phase 0 skeleton.
 */
@Module({
  controllers: [Core-apiController],
})
export class Core-apiModule {}
