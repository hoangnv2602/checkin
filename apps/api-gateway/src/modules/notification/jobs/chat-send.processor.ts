/**
 * apps/api-gateway/src/modules/notification/jobs/chat-send.processor.ts
 *
 * I-802 — BullMQ worker cho chat:send queue. Pick provider từ job data,
 * route tới adapter tương ứng.
 */
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import {
  type ChatSendJobData,
  CHAT_SEND_QUEUE,
} from "../chat-notifier.service";
import { SlackAdapter } from "../adapters/slack.adapter";
import { DiscordAdapter } from "../adapters/discord.adapter";

@Processor(CHAT_SEND_QUEUE, { concurrency: 5 })
export class ChatSendProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatSendProcessor.name);

  constructor(
    private readonly slack: SlackAdapter,
    private readonly discord: DiscordAdapter,
  ) {
    super();
  }

  async process(job: Job<ChatSendJobData>): Promise<{ providerMessageId: string }> {
    const { message, provider } = job.data;
    const adapter = provider === "slack" ? this.slack : this.discord;
    this.logger.log(`chat.send job=${job.id} provider=${provider} tenant=${message.tenantId}`);

    const result = await adapter.send(message);
    return { providerMessageId: result.providerMessageId };
  }
}
