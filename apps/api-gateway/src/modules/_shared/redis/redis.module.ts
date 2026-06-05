/**
 * apps/api-gateway/src/modules/_shared/redis/redis.module.ts
 *
 * ioredis client singleton. Dùng cho:
 *  - JWT signing key cache (mirror core-api `jwt:signing:key`)
 *  - Refresh token whitelist/blacklist (prefix `rt:`)
 *  - Socket.IO Redis adapter (realtime module)
 */
import { Global, Module, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS = "REDIS";

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (): Redis => {
        const url = process.env.REDIS_URL ?? "redis://localhost:6380";
        const client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
        client.on("error", (err) => {
          // Don't crash process — Redis may be down briefly during dev
          // eslint-disable-next-line no-console
          console.error("[redis] error:", err.message);
        });
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}
  async onModuleDestroy(): Promise<void> {
    // ioredis auto-closes on process exit
  }
}
