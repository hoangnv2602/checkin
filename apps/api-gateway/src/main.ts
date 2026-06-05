/**
 * apps/api-gateway/src/main.ts — bootstrap NestJS BFF.
 *
 * Phase 0: boot HTTP server + Socket.IO gateway + Swagger UI.
 * Phase 1+ thêm: gRPC client tới core-api, JWT auth guard, BullMQ workers.
 */
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // OpenAPI 3.1 auto-gen (D8)
  const config = new DocumentBuilder()
    .setTitle("SaaS Check-in API Gateway")
    .setVersion("0.0.0")
    .addBearerAuth()
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
