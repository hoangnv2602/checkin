/**
 * apps/api-gateway/src/modules/notification/rate-limit/rate-limit.module.ts
 *
 * I-802 — module wrapper cho chat rate limiter (decoupled để swap Redis → in-memory stub dễ test).
 */
import { Module } from "@nestjs/common";
import { ChatRateLimiter } from "./chat-rate-limiter";

@Module({
  providers: [ChatRateLimiter],
  exports: [ChatRateLimiter],
})
export class ChatRateLimitModule {}
