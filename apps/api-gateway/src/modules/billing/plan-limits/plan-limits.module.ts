/**
 * apps/api-gateway/src/modules/billing/plan-limits/plan-limits.module.ts
 */
import { Module } from "@nestjs/common";
import { PlanLimitGuard } from "./plan-limit.guard";
import { RedisModule } from "../../_shared/redis/redis.module";

@Module({
  imports: [RedisModule],
  providers: [PlanLimitGuard],
  exports: [PlanLimitGuard],
})
export class PlanLimitsModule {}
