import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { EventsModule } from "./modules/events/events.module";
import { RegistrationModule } from "./modules/registration/registration.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { CoreApiModule } from "./modules/core-api/core-api.module";
import { GrpcModule } from "./modules/grpc/grpc.module";
import { GrpcServerModule } from "./modules/grpc-server/grpc-server.module";
import { RedisModule } from "./modules/_shared/redis/redis.module";
import { CheckinAdminAuthModule } from "./modules/checkin-admin/admin-auth.module";
import { SubscriptionModule } from "./modules/billing/subscription/subscription.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuditModule } from "./modules/audit/audit.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { QueueModule } from "./modules/_shared/queue/queue.module";
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
    EventsModule,    // I-202: events (BFF → gRPC EventService)
    RegistrationModule, // I-303: ticketing (BFF → gRPC TicketingService)
    RealtimeModule,  // Socket.IO + Redis adapter — Phase 0 init
    JobsModule,      // BullMQ init — Phase 1
    CoreApiModule,   // gRPC client tới core-api:50051 — Phase 1
    CheckinAdminAuthModule, // I-107: platform admin auth (POST /v1/admin/auth/*)
    SubscriptionModule, // I-501: subscription management + Stripe sub webhook
    AnalyticsModule,    // I-601: event stats report + CSV export
    AuditModule,        // I-602: audit log viewer (Owner only)
    OnboardingModule,   // I-703: 5-step wizard state (Redis-backed, 90-day TTL)
    QueueModule,        // I-806: DLQ + stuck-job detector + queue depth metrics
  ],
  providers: [
    // Global JWT guard — opt-out via @Public() decorator
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
