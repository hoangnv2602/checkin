/**
 * apps/api-gateway/src/modules/notification/chat-config.service.ts
 *
 * I-802 — Per-tenant chat config: provider (slack|discord) + webhook URL + channel id.
 *
 * Storage: Redis hash `tenant:{tenantId}:chat` với TTL 24h.
 * API: internal API key để set/update từ web (apps/web/src/modules/settings/).
 *
 * Schema (JSON value):
 *   {
 *     provider: "slack" | "discord",
 *     webhookUrl: "https://hooks.slack.com/...",
 *     defaultChannel: "C012345",   // optional, default channel
 *     createdAt: "2026-06-06T..."
 *   }
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";
import type { ChatProvider } from "./adapters/chat-sender.interface";

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = "tenant:chat:";

export interface ChatConfig {
  provider: ChatProvider;
  webhookUrl: string;
  defaultChannel?: string;
  createdAt: string;
}

@Injectable()
export class ChatConfigService {
  private readonly logger = new Logger(ChatConfigService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async get(tenantId: string): Promise<ChatConfig | null> {
    const raw = await this.redis.get(KEY_PREFIX + tenantId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ChatConfig;
    } catch (err) {
      this.logger.warn(`chat config parse failed tenant=${tenantId} err=${(err as Error).message}`);
      return null;
    }
  }

  async set(tenantId: string, config: ChatConfig): Promise<void> {
    await this.redis.set(KEY_PREFIX + tenantId, JSON.stringify(config), "EX", CACHE_TTL_SECONDS);
  }

  async delete(tenantId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + tenantId);
  }
}
