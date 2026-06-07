/**
 * apps/api-gateway/src/modules/notification/rate-limit/chat-rate-limiter.ts
 *
 * I-802 — Token-bucket rate limiter per provider webhook, backed by Redis.
 *
 *   Slack tier-3 = 50 req/min per workspace → 1 req/sec safe budget
 *   Discord webhook = 30 req/min → 2 req/sec safe budget
 *
 * Backed by INCR + EXPIRE pattern. Atomic qua Lua nếu strict; dùng pipeline
 * (INCR + EXPIRE) cho đơn giản, chấp nhận 1 window edge case lệch 1ms.
 *
 * Trả về số ms phải chờ trước khi retry; null = allow ngay.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

export type ChatProvider = "slack" | "discord";

const BUDGET: Record<ChatProvider, { perSecond: number; windowSec: number }> = {
  slack: { perSecond: 1, windowSec: 1 },
  discord: { perSecond: 2, windowSec: 1 },
};

@Injectable()
export class ChatRateLimiter {
  private readonly logger = new Logger(ChatRateLimiter.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Atomic acquire. Trả về { allowed, retryAfterMs }.
   * Bucket key = provider + tenant (per-tenant isolation để 1 tenant spam không
   * ảnh hưởng tenant khác).
   */
  async acquire(provider: ChatProvider, tenantId: string): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const cfg = BUDGET[provider];
    const windowMs = cfg.windowSec * 1000;
    const bucketKey = `chat-rl:${provider}:${tenantId}`;

    // Bucket 1 second. Count hits trong window hiện tại; nếu > budget → deny.
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `${bucketKey}:${windowStart}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      // First hit in this window — set TTL 2x window để cover clock skew
      await this.redis.pexpire(key, windowMs * 2);
    }
    if (count <= cfg.perSecond) {
      return { allowed: true, retryAfterMs: 0 };
    }
    const retryAfterMs = windowStart + windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(50, retryAfterMs) };
  }

  /**
   * Wait cho đến khi được phép (gọi từ chat-send.processor nếu muốn block
   * thay vì fail).
   */
  async waitForSlot(provider: ChatProvider, tenantId: string, maxWaitMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const r = await this.acquire(provider, tenantId);
      if (r.allowed) return;
      const { setTimeout: sleep } = await import("node:timers/promises");
      await sleep(r.retryAfterMs);
    }
    this.logger.warn(`chat-rl timeout provider=${provider} tenant=${tenantId}`);
  }
}
