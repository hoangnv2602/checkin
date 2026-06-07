/**
 * apps/api-gateway/src/modules/tenancy/domain-admin.controller.ts
 *
 * I-804 — Admin API: set/invalidate custom domain mapping.
 * Auth: x-internal-key. Plan gate: chỉ Enterprise.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
import { DomainResolverService } from "./domain-resolver.service";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

@Controller("v1/internal/domain")
export class DomainAdminController {
  constructor(private readonly resolver: DomainResolverService) {}

  private assertKey(key: string): void {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
  }

  @Post("cache")
  async cache(
    @Headers("x-internal-key") key: string,
    @Body() body: { host: string; tenantId: string; plan?: string },
  ): Promise<{ ok: true }> {
    this.assertKey(key);
    if (!body.host || !body.tenantId) {
      throw new BadRequestException("host and tenantId required");
    }
    await this.resolver.cacheDomain(body.host, body.tenantId, body.plan ?? "enterprise");
    return { ok: true };
  }

  @Delete("cache/:host")
  async invalidate(
    @Headers("x-internal-key") key: string,
    @Param("host") host: string,
  ): Promise<{ ok: true }> {
    this.assertKey(key);
    await this.resolver.invalidate(host);
    return { ok: true };
  }
}
