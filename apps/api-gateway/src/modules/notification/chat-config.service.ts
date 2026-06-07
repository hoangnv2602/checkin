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
 *     webhookUrlEnc: "base64(iv|tag|ct)",   // AES-256-GCM encrypted
 *     defaultChannel: "C012345",            // optional, default channel
 *     createdAt: "2026-06-06T..."
 *   }
 *
 * Plaintext webhook URL KHÔNG bao giờ xuất hiện trong logs, response body,
 * hay stored trong Redis ở dạng readable — chỉ `webhookUrlEnc`.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../_shared/redis/redis.module";
import { decryptSecret, encryptSecret } from "../_shared/crypto/secrets";
import type { ChatProvider } from "./adapters/chat-sender.interface";

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = "tenant:chat:";

export interface ChatConfigInput {
  provider: ChatProvider;
  webhookUrl: string;
  defaultChannel?: string;
}

export interface ChatConfig {
  provider: ChatProvider;
  webhookUrlEnc: string;
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
      const parsed = JSON.parse(raw) as ChatConfig;
      if (!parsed.webhookUrlEnc) return null;
      return parsed;
    } catch (err) {
      this.logger.warn(`chat config parse failed tenant=${tenantId} err=${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Decrypt webhook URL on-demand. Adapter dùng hàm này để resolve URL.
   * Không cache plaintext — mỗi call đi qua AES-256-GCM.
   */
  async getDecryptedWebhook(
    tenantId: string,
  ): Promise<{ url: string; provider: ChatProvider; defaultChannel?: string } | null> {
    const cfg = await this.get(tenantId);
    if (!cfg) return null;
    try {
      const url = decryptSecret(cfg.webhookUrlEnc);
      return { url, provider: cfg.provider, defaultChannel: cfg.defaultChannel };
    } catch (err) {
      this.logger.error(
        `chat webhook decrypt failed tenant=${tenantId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async set(tenantId: string, input: ChatConfigInput): Promise<void> {
    const webhookUrlEnc = encryptSecret(input.webhookUrl);
    const config: ChatConfig = {
      provider: input.provider,
      webhookUrlEnc,
      defaultChannel: input.defaultChannel,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(
      KEY_PREFIX + tenantId,
      JSON.stringify(config),
      "EX",
      CACHE_TTL_SECONDS,
    );
  }

  async delete(tenantId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + tenantId);
  }
}
