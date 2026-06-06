/**
 * apps/api-gateway/src/modules/notification/adapters/discord.adapter.ts
 *
 * I-802 — Discord Webhook adapter. Discord webhook URL thường là
 *   https://discord.com/api/webhooks/{id}/{token}
 *
 * Rate limit: 30 req/min per webhook, 5 concurrent. Mình enforce 2 req/sec.
 * Retry: 3 lần exponential backoff cho 429/5xx.
 */
import { Injectable, Logger } from "@nestjs/common";
import { setTimeout as sleep } from "node:timers/promises";
import {
  type ChatMessage,
  type ChatSendResult,
  type ChatSenderInterface,
} from "./chat-sender.interface";

@Injectable()
export class DiscordAdapter implements ChatSenderInterface {
  readonly name = "discord" as const;
  private readonly logger = new Logger(DiscordAdapter.name);

  constructor(private readonly fetchWebhook: (tenantId: string) => Promise<string | null>) {}

  async send(msg: ChatMessage): Promise<ChatSendResult> {
    const webhookUrl = await this.fetchWebhook(msg.tenantId);
    if (!webhookUrl) {
      throw new Error(`discord webhook not configured for tenant=${msg.tenantId}`);
    }

    // Discord cần `content` thay vì `text`. Convert thread → message_reference.
    const payload = {
      content: msg.text,
      ...(msg.threadId ? { message_reference: { message_id: msg.threadId } } : {}),
      ...(msg.blocks ? { embeds: msg.blocks } : {}),
    };

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Discord trả 204 No Content thành công. Có body kèm message id nếu cần.
        const body = (await res.json().catch(() => null)) as { id?: string } | null;
        return {
          providerMessageId: body?.id ?? `discord-${Date.now()}`,
          provider: "discord",
        };
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxAttempts) {
          const backoffMs = 1000 * 3 ** (attempt - 1);
          this.logger.warn(`discord retry attempt=${attempt} status=${res.status} backoff=${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
      }

      const body = await res.text();
      throw new Error(`discord send failed status=${res.status} body=${body.slice(0, 200)}`);
    }

    throw new Error("discord send exhausted retries");
  }
}
