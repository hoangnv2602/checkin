/**
 * apps/api-gateway/src/main.ts — bootstrap NestJS BFF.
 *
 * Phase 0: boot HTTP server + Socket.IO gateway + Swagger UI.
 * Phase 1+: gRPC client, JWT auth guard (global), BullMQ workers, cookie-parser.
 */
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`API Gateway listening on http://localhost:${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/v1/docs`);
}

bootstrap();
