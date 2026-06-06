/**
 * apps/api-gateway/src/modules/notification/chat-notifier.service.ts
 *
 * I-802 — ChatNotifierService: chọn adapter theo tenant config, queue qua BullMQ.
 *
 * Flow:
 *   1. Caller (alert job, event publish, plan limit hit) gọi notify()
 *   2. Service lookup ChatConfigService → lấy provider + webhook
 *   3. Enqueue job vào BullMQ queue `chat:send` với payload
 *   4. Worker (chat-send.processor) pick up, gọi adapter.send()
 *   5. Retry 3 lần với exponential backoff, fail → DLQ
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ChatConfigService } from "./chat-config.service";
import {
  type ChatMessage,
  type ChatProvider,
} from "./adapters/chat-sender.interface";

export const CHAT_SEND_QUEUE = "chat:send";

export interface ChatSendJobData {
  message: ChatMessage;
  provider: ChatProvider;
}

@Injectable()
export class ChatNotifierService {
  private readonly logger = new Logger(ChatNotifierService.name);

  constructor(
    private readonly config: ChatConfigService,
    @InjectQueue(CHAT_SEND_QUEUE) private readonly queue: Queue<ChatSendJobData>,
  ) {}

  /**
   * Fire-and-forget. Trả về false nếu tenant chưa config chat.
   */
  async notify(message: ChatMessage): Promise<boolean> {
    const cfg = await this.config.get(message.tenantId);
    if (!cfg) {
      this.logger.warn(`chat not configured tenant=${message.tenantId}`);
      return false;
    }
    await this.queue.add(
      "send",
      { message, provider: cfg.provider },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );
    return true;
  }

  /**
   * Send sync (test/manual trigger từ admin). Dùng cho preview hoặc retry từ DLQ.
   */
  async notifySync(message: ChatMessage): Promise<boolean> {
    return this.notify(message);
  }
}
