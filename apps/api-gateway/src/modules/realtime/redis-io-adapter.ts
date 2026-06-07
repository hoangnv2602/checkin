/**
 * apps/api-gateway/src/modules/realtime/redis-io-adapter.ts
 *
 * IoAdapter implementation dùng @socket.io/redis-adapter để fanout
 * Socket.IO events across nhiều api-gateway instances (Phase 4 I-402).
 *
 * Reference: https://socket.io/docs/v4/redis-adapter/
 */
import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { INestApplicationContext } from "@nestjs/common";
import { REDIS } from "../_shared/redis/redis.module";

export class RedisIoAdapter extends IoAdapter {
  private readonly appRef: INestApplicationContext;

  constructor(app: INestApplicationContext) {
    super(app);
    this.appRef = app;
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: [
          "http://localhost:3000",
          "http://localhost:3002",
          /^https:\/\/(.*\.)?saas-checkin\.com$/,
        ],
        credentials: true,
      },
    }) as ReturnType<IoAdapter["createIOServer"]>;

    const redis = this.appRef.get<Redis>(REDIS);
    if (!redis) {
      // No redis → run single-instance mode (no cross-instance fanout)
      return server;
    }

    // @socket.io/redis-adapter needs 2 dedicated connections (pub + sub)
    const pubClient = redis.duplicate();
    const subClient = pubClient.duplicate();

    const adapter = createAdapter(pubClient, subClient);
    (server as any).adapter(adapter);

    return server;
  }
}
