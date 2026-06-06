/**
 * apps/api-gateway/src/modules/notification/notification.module.ts
 *
 * I-305: Email notifier (Resend)
 * I-802: Chat notifier (Slack + Discord) — per-tenant config in Redis
 */
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ResendAdapter } from "./adapters/resend.adapter";
import { SlackAdapter } from "./adapters/slack.adapter";
import { DiscordAdapter } from "./adapters/discord.adapter";
import { EmailNotifierService, EMAIL_SEND_QUEUE } from "./email-notifier.service";
import { EmailSendProcessor } from "./jobs/email-send.processor";
import {
  ChatNotifierService,
  CHAT_SEND_QUEUE,
} from "./chat-notifier.service";
import { ChatConfigService } from "./chat-config.service";
import { ChatSendProcessor } from "./jobs/chat-send.processor";
import { ChatConfigController } from "./chat-config.controller";

@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_SEND_QUEUE }),
    BullModule.registerQueue({ name: CHAT_SEND_QUEUE }),
  ],
  providers: [
    // Email (I-305)
    ResendAdapter,
    EmailNotifierService,
    EmailSendProcessor,
    // Chat (I-802)
    ChatConfigService,
    ChatNotifierService,
    ChatSendProcessor,
    {
      provide: SlackAdapter,
      useFactory: (cfg: ChatConfigService) => new SlackAdapter((tid) => cfg.get(tid).then((c) => c?.webhookUrl ?? null)),
      inject: [ChatConfigService],
    },
    {
      provide: DiscordAdapter,
      useFactory: (cfg: ChatConfigService) => new DiscordAdapter((tid) => cfg.get(tid).then((c) => c?.webhookUrl ?? null)),
      inject: [ChatConfigService],
    },
  ],
  controllers: [ChatConfigController],
  exports: [
    EmailNotifierService,
    ResendAdapter,
    ChatNotifierService,
    ChatConfigService,
  ],
})
export class NotificationModule {}
