/**
 * apps/api-gateway/test/setup.ts
 *
 * Global test setup — set env defaults, silence logger, ensure no real network.
 */
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:0";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:0";
