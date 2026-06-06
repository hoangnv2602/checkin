import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EventsModule } from "./modules/events/events.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { CoreApiModule } from "./modules/core-api/core-api.module";
import { GrpcModule } from "./modules/grpc/grpc.module";
import { GrpcServerModule } from "./modules/grpc-server/grpc-server.module";
import { RedisModule } from "./modules/_shared/redis/redis.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";

@Module({
  imports: [
    // Pino logger — JSON output, no transport (pino-pretty not in deps)
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),

    // Infrastructure
    RedisModule,  // ioredis client (JWT key cache, refresh tokens)
    GrpcModule,   // gRPC client tới core-api:50051
    GrpcServerModule, // I-801: gRPC server :50052 for mobile clients

    // Feature modules
    HealthModule,
    AuthModule,      // I-102: real auth (login/refresh/logout/whoami)
    EventsModule,    // stub proxy — Phase 2
    RealtimeModule,  // Socket.IO + Redis adapter — Phase 0 init
    JobsModule,      // BullMQ init — Phase 1
    CoreApiModule,   // gRPC client tới core-api:50051 — Phase 1
  ],
  providers: [
    // Global JWT guard — opt-out via @Public() decorator
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
