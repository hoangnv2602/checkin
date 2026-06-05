import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";

/**
 * AuthModule — Phase 0 skeleton.
 */
@Module({
  controllers: [AuthController],
})
export class AuthModule {}
