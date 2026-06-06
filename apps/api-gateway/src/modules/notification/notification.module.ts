/**
 * apps/api-gateway/src/modules/notification/notification.module.ts
 */
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ResendAdapter } from "./adapters/resend.adapter";
import { EmailNotifierService, EMAIL_SEND_QUEUE } from "./email-notifier.service";
import { EmailSendProcessor } from "./jobs/email-send.processor";

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_SEND_QUEUE })],
  providers: [ResendAdapter, EmailNotifierService, EmailSendProcessor],
  exports: [EmailNotifierService, ResendAdapter],
})
export class NotificationModule {}
