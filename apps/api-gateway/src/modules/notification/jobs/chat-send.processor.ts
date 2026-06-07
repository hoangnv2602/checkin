/**
 * apps/api-gateway/src/modules/notification/jobs/chat-send.processor.ts
 *
 * I-802 + I-806 — BullMQ worker cho chat:send queue. Pick provider từ job
 * data, route tới adapter tương ứng. Auto-promote to DLQ on exhaustion
 * (BaseDlqProcessor.onFailed).
 */
import { InjectQueue, Processor } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { SlackAdapter } from "../adapters/slack.adapter";
import { DiscordAdapter } from "../adapters/discord.adapter";
import {
  type ChatSendJobData,
  CHAT_SEND_QUEUE,
} from "../chat-notifier.service";
import { BaseDlqProcessor } from "../../_shared/queue/base-dlq-processor";
import { DlqService } from "../../_shared/queue/dlq.service";

@Processor(CHAT_SEND_QUEUE, { concurrency: 5 })
export class ChatSendProcessor extends BaseDlqProcessor<ChatSendJobData, { providerMessageId: string }> {
  constructor(
    private readonly slack: SlackAdapter,
    private readonly discord: DiscordAdapter,
    dlq: DlqService,
    @InjectQueue(CHAT_SEND_QUEUE) queue: Queue<ChatSendJobData>,
  ) {
    super(dlq, queue);
  }

  async process(job: Job<ChatSendJobData>): Promise<{ providerMessageId: string }> {
    const { message, provider } = job.data;
    const adapter = provider === "slack" ? this.slack : this.discord;
    this.logger.log(`chat.send job=${job.id} provider=${provider} tenant=${message.tenantId}`);

    const result = await adapter.send(message);
    return { providerMessageId: result.providerMessageId };
  }
}
