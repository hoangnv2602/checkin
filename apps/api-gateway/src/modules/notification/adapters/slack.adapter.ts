/**
 * apps/api-gateway/src/modules/notification/adapters/slack.adapter.ts
 *
 * I-802 — Slack Web API adapter. Dùng Incoming Webhook (đơn giản nhất, không cần
 * OAuth bot install) hoặc chat.postMessage nếu có bot token.
 *
 * Rate limit: Slack tier-3 = 50 req/min. Mình enforce 1 req/sec per webhook qua Redis.
 * Retry: 3 lần exponential backoff (1s, 3s, 9s) cho 429/5xx.
 */
import { Injectable, Logger } from "@nestjs/common";
import { setTimeout as sleep } from "node:timers/promises";
import {
  type ChatMessage,
  type ChatSendResult,
  type ChatSenderInterface,
} from "./chat-sender.interface";
import { ChatRateLimiter } from "../rate-limit/chat-rate-limiter";

@Injectable()
export class SlackAdapter implements ChatSenderInterface {
  readonly name = "slack" as const;
  private readonly logger = new Logger(SlackAdapter.name);

  /**
   * @param fetchWebhook  Resolve tenantId → webhook URL (decrypt on demand).
   * @param rateLimiter   Optional — wire from chat-send.processor for prod.
   *                      Tests inject undefined để skip rate limiting.
   */
  constructor(
    private readonly fetchWebhook: (tenantId: string) => Promise<string | null>,
    private readonly rateLimiter?: ChatRateLimiter,
  ) {}

  async send(msg: ChatMessage): Promise<ChatSendResult> {
    if (this.rateLimiter) {
      await this.rateLimiter.waitForSlot("slack", msg.tenantId);
    }
    const webhookUrl = await this.fetchWebhook(msg.tenantId);
    if (!webhookUrl) {
      throw new Error(`slack webhook not configured for tenant=${msg.tenantId}`);
    }

    const payload = {
      channel: msg.channelId,
      text: msg.text,
      ...(msg.threadId ? { thread_ts: msg.threadId } : {}),
      ...(msg.blocks ? { blocks: msg.blocks } : {}),
    };

    const maxAttempts = 3;
    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { ts?: string; ok?: boolean };
        if (body.ok === false) {
          throw new Error(`slack api error: ${JSON.stringify(body)}`);
        }
        return {
          providerMessageId: body.ts ?? `slack-${Date.now()}`,
          provider: "slack",
        };
      }

      lastStatus = res.status;
      lastBody = await res.text();

      if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
        const backoffMs = 1000 * 3 ** (attempt - 1);
        this.logger.warn(
          `slack retry attempt=${attempt} status=${res.status} backoff=${backoffMs}ms`,
        );
        await sleep(backoffMs);
        continue;
      }
      // Non-retryable status, or last attempt: fall through to throw below.
      break;
    }

    throw new Error(
      `slack send failed status=${lastStatus} body=${lastBody.slice(0, 200)} (exhausted ${maxAttempts} attempts)`,
    );
  }
}
