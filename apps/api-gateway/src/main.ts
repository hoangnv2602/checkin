/**
 * apps/api-gateway/src/main.ts — bootstrap NestJS BFF.
 *
 * Phase 0: boot HTTP server + Socket.IO gateway + Swagger UI.
 * Phase 1+: gRPC client, JWT auth guard (global), BullMQ workers, cookie-parser.
 * Phase 8 (I-801): gRPC server :50052 cho mobile clients.
 */
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { grpcServerOptions } from "./modules/grpc-server/grpc-server.config";
import { startTracing } from "./modules/_shared/observability/otel";
import { initSentry } from "./modules/_shared/observability/sentry";
import { SentryExceptionFilter } from "./modules/_shared/observability/sentry.interceptor";

// I-603: OpenTelemetry must be started BEFORE any other imports that should
// be instrumented. We do it in a separate require-style import at the very top
// of the module to give auto-instrumentation a chance to patch.
startTracing("api-gateway");
initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // I-603: capture 5xx to Sentry. 4xx is expected (auth, validation).
  app.useGlobalFilters(new SentryExceptionFilter());

  // Parse cookies (Phase 1: sa_access_token, sa_refresh_token cho web/mobile)
  app.use(cookieParser());

  // OpenAPI 3.1 auto-gen (D8)
  const config = new DocumentBuilder()
    .setTitle("SaaS Check-in API Gateway")
    .setVersion("0.0.0")
    .addBearerAuth()
    .addCookieAuth("sa_access_token")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("v1/docs", app, document);

  // CORS — web + checkin-admin + mobile
  app.enableCors({
    origin: [
      "http://localhost:3000",        // apps/web
      "http://localhost:3002",        // apps/checkin-admin
      /^https:\/\/(.*\.)?saas-checkin\.com$/,  // prod
    ],
    credentials: true,
  });

  // I-402: Redis adapter cho Socket.IO (cross-instance fanout).
  // Phải chạy trước app.listen() để IoAdapter dùng Redis pub/sub.
  const { RedisIoAdapter } = await import("./modules/realtime/redis-io-adapter");
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  // I-801: gRPC server cho mobile (port 50052 mặc định).
  // Tắt qua GRPC_SERVER_ENABLED=false khi dev không có core-api chạy.
  if (process.env.GRPC_SERVER_ENABLED !== "false") {
    app.connectMicroservice(grpcServerOptions(), { inheritAppConfig: true });
    await app.startAllMicroservices();
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`API Gateway listening on http://localhost:${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/v1/docs`);
  if (process.env.GRPC_SERVER_ENABLED !== "false") {
    logger.log(`gRPC server listening on :${process.env.GRPC_SERVER_PORT ?? 50052}`);
  }
}

bootstrap();
