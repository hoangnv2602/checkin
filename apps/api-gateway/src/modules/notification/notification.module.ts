/**
 * apps/api-gateway/src/modules/notification/notification.module.ts
 *
 * I-305: Email notifier (Resend)
 * I-802: Chat notifier (Slack + Discord) — per-tenant config in Redis,
 *        webhook URL encrypted at rest, per-tenant rate limit
 * I-806: Auto-promote to DLQ on exhaustion (BaseDlqProcessor); queues
 *        registered với MONITORED_QUEUES token ở onApplicationBootstrap
 *        for stuck-job sweep.
 */
import { Inject, InjectQueue, Module, type OnApplicationBootstrap } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
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
import { MONITORED_QUEUES } from "../_shared/queue/queue.module";

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
export class NotificationModule implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(EMAIL_SEND_QUEUE) private readonly emailQ: Queue,
    @InjectQueue(CHAT_SEND_QUEUE) private readonly chatQ: Queue,
    @Inject(MONITORED_QUEUES) private readonly monitored: Queue<unknown>[],
  ) {}

  onApplicationBootstrap(): void {
    if (!this.monitored.find((q) => q.name === this.emailQ.name)) {
      this.monitored.push(this.emailQ);
    }
    if (!this.monitored.find((q) => q.name === this.chatQ.name)) {
      this.monitored.push(this.chatQ);
    }
  }
}
