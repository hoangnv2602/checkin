/**
 * apps/api-gateway/src/modules/billing/plan-limits/plan-limit.guard.ts
 *
 * I-502 — PlanLimitGuard. NestJS guard check usage hiện tại vs plan limit
 * trước khi mutate (CreateEvent, RegisterAttendee, InviteMember).
 *
 * Return 402 Payment Required với code plan_limit_exceeded + details
 * { limit, current }.
 *
 * Cache 5 phút Redis; invalidate khi subscription đổi (subscribe hook ở
 * SubscriptionModule ở Phase 6).
 */
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
  SetMetadata,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

export const PLAN_LIMIT_KIND_KEY = "planLimitKind";
export const PlanLimit = (kind: PlanLimitKind) => SetMetadata(PLAN_LIMIT_KIND_KEY, kind);

export type PlanLimitKind = "ActiveEvents" | "AttendeesThisMonth" | "StaffSeats";

const CACHE_TTL_SECONDS = 5 * 60;

@Injectable()
export class PlanLimitGuard implements CanActivate {
  private readonly logger = new Logger(PlanLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.getAllAndOverride<PlanLimitKind>(PLAN_LIMIT_KIND_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!kind) return true;  // No limit set — pass through

    const req = ctx.switchToHttp().getRequest();
    const organizationId =
      (req.headers?.["x-tenant-id"] as string | undefined) ??
      (req.body?.organizationId as string | undefined);
    if (!organizationId) {
      throw new HttpException(
        { code: "missing_tenant", message: "organizationId required" },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cacheKey = this.cacheKey(organizationId, kind);
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const check = JSON.parse(cached) as PlanLimitCheckResponse;
        if (!check.allowed) throw this.toHttpException(check);
        return true;
      }
    }

    const check = await this.fetchFromCoreApi(organizationId, kind);
    if (this.redis) {
      await this.redis.set(cacheKey, JSON.stringify(check), "EX", CACHE_TTL_SECONDS);
    }
    if (!check.allowed) throw this.toHttpException(check);
    return true;
  }

  private async fetchFromCoreApi(
    organizationId: string,
    kind: PlanLimitKind,
  ): Promise<PlanLimitCheckResponse> {
    const coreApi = process.env.CORE_API_BASE ?? "http://localhost:5050";
    const res = await fetch(`${coreApi}/v1/billing/plan-limit/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": organizationId },
      body: JSON.stringify({ organizationId, kind }),
    });
    if (res.status === 404) {
      // No subscription record yet — fallback to allowing (org đang onboarding)
      return { allowed: true };
    }
    if (!res.ok) {
      // Treat as transient — allow and log
      this.logger.warn(`plan-limit check failed: ${res.status} ${await res.text()}`);
      return { allowed: true };
    }
    return (await res.json()) as PlanLimitCheckResponse;
  }

  private cacheKey(orgId: string, kind: PlanLimitKind): string {
    return `plan-limit:${orgId}:${kind}`;
  }

  private toHttpException(check: PlanLimitCheckResponse): HttpException {
    return new HttpException(
      {
        code: check.code ?? "plan_limit_exceeded",
        message: check.message ?? "Plan limit exceeded",
        details: { limit: check.limit, current: check.current },
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

interface PlanLimitCheckResponse {
  allowed: boolean;
  code?: string;
  message?: string;
  limit?: number;
  current?: number;
}
