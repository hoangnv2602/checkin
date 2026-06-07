/**
 * apps/api-gateway/src/modules/notification/notification.module.ts
 *
 * I-305: Email notifier (Resend)
 * I-802: Chat notifier (Slack + Discord) — per-tenant config in Redis,
 *        webhook URL encrypted at rest, per-tenant rate limit
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
import { ChatRateLimitModule } from "./rate-limit/rate-limit.module";
import { ChatRateLimiter } from "./rate-limit/chat-rate-limiter";

@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_SEND_QUEUE }),
    BullModule.registerQueue({ name: CHAT_SEND_QUEUE }),
    ChatRateLimitModule,
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
      useFactory: (cfg: ChatConfigService, rl: ChatRateLimiter) =>
        new SlackAdapter(
          (tid) => cfg.getDecryptedWebhook(tid).then((c) => c?.url ?? null),
          rl,
        ),
      inject: [ChatConfigService, ChatRateLimiter],
    },
    {
      provide: DiscordAdapter,
      useFactory: (cfg: ChatConfigService, rl: ChatRateLimiter) =>
        new DiscordAdapter(
          (tid) => cfg.getDecryptedWebhook(tid).then((c) => c?.url ?? null),
          rl,
        ),
      inject: [ChatConfigService, ChatRateLimiter],
    },
  ],
  controllers: [ChatConfigController],
  exports: [
    EmailNotifierService,
    ResendAdapter,
    ChatNotifierService,
    ChatConfigService,
    ChatRateLimiter,
  ],
})
export class NotificationModule {}
