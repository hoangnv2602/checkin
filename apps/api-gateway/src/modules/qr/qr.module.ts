/**
 * apps/api-gateway/src/modules/qr/qr.module.ts
 *
 * I-304 — QR generation module. Worker consumes TicketIssuedIntegrationEvent
 * (in-process MediatR / future MassTransit) → render QR PNG/SVG → upload to
 * S3/MinIO → update Registration.qr_image_url qua core-api.
 */
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QrGeneratorProcessor, QR_GENERATE_QUEUE } from "./worker/qr-generator.processor";
import { LocalQrStorage } from "./storage/local-qr-storage";
import { S3QrStorage } from "./storage/s3-qr-storage";
import { QrRenderService } from "./service/qr-render.service";
import { RedisModule } from "../_shared/redis/redis.module";

@Module({
  imports: [RedisModule, BullModule.registerQueue({ name: QR_GENERATE_QUEUE })],
  providers: [QrGeneratorProcessor, QrRenderService, LocalQrStorage, S3QrStorage],
  exports: [QrRenderService],
})
export class QrModule {}
