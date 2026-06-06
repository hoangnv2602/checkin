/**
 * apps/api-gateway/src/modules/billing/plan-limits/plan-limit.controller.ts
 *
 * I-502 — Bridge to .NET core-api plan-limit check + invalidation webhook.
 */
import { Body, Controller, ForbiddenException, Headers, Post } from "@nestjs/common";
import { REDIS } from "../../_shared/redis/redis.module";
import { Inject, Optional } from "@nestjs/common";
import type Redis from "ioredis";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

@Controller("v1/billing/plan-limit")
export class PlanLimitController {
  constructor(@Optional() @Inject(REDIS) private readonly redis?: Redis) {}

  @Post("invalidate")
  async invalidate(
    @Headers("x-internal-key") key: string,
    @Body() body: { organizationId: string; kind?: string },
  ) {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
    if (!this.redis) return { invalidated: false };
    if (body.kind) {
      await this.redis.del(`plan-limit:${body.organizationId}:${body.kind}`);
    } else {
      // Wipe all kinds for tenant
      const kinds = ["ActiveEvents", "AttendeesThisMonth", "StaffSeats"];
      await Promise.all(
        kinds.map((k) => this.redis!.del(`plan-limit:${body.organizationId}:${k}`)),
      );
    }
    return { invalidated: true };
  }
}
