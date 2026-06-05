import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EventsModule } from "./modules/events/events.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { CoreApiModule } from "./modules/core-api/core-api.module";

@Module({
  imports: [
    // Pino logger — JSON output, no transport (pino-pretty not in deps)
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),

    // Feature modules
    HealthModule,
    AuthModule,      // stub — Phase 1
    EventsModule,    // stub proxy — Phase 2
    RealtimeModule,  // Socket.IO + Redis adapter — Phase 0 init
    JobsModule,      // BullMQ init — Phase 1
    CoreApiModule,   // gRPC client tới core-api:50051 — Phase 1
  ],
})
export class AppModule {}
