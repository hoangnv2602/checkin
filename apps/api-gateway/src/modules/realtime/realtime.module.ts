/**
 * apps/api-gateway/src/modules/realtime/realtime.module.ts
 *
 * I-402 — wires Socket.IO gateway + emit controller + Redis adapter.
 */
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeController } from "./realtime.controller";
import { RealtimeEmitController } from "./realtime-emit.controller";
import { EventCheckinGateway } from "./gateways/event-checkin.gateway";
import { RedisModule } from "../_shared/redis/redis.module";

@Module({
  imports: [
    RedisModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_PUBLIC_KEY ?? "dev-secret",
        algorithms: ["RS256"],
        verifyOptions: { audience: "tenant-web" },
      }),
    }),
  ],
  controllers: [RealtimeController, RealtimeEmitController],
  providers: [EventCheckinGateway],
  exports: [EventCheckinGateway],
})
export class RealtimeModule {}
