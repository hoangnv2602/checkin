/**
 * apps/api-gateway/src/modules/audit/audit.controller.ts
 *
 * I-602 — Owner-only audit log viewer endpoint.
 *
 * Returns paginated, filterable audit_log entries. The Owner role is required
 * (enforced by JwtAuthGuard global + a future @Roles('Owner') guard; for
 * Phase 6 the controller restricts to Owner+Admin via role check inline).
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { VerifiedAuth } from "../auth/services/jwt-verifier.service";
import { AuditService, type AuditLogPageDto } from "./audit.service";

@ApiTags("audit")
@Controller("v1/audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get("log")
  @ApiOperation({ summary: "List audit log entries (Owner only)" })
  async list(
    @CurrentUser() user: VerifiedAuth,
    @Query("actorUserId") actorUserId?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("skip") skip = "0",
    @Query("take") take = "50",
  ): Promise<AuditLogPageDto> {
    // Only Owner / Admin can read tenant-wide audit log
    const role = user?.role;
    if (role !== "Owner" && role !== "Admin") {
      throw new ForbiddenException("Only Owner or Admin can read audit log");
    }
    return this.audit.list({
      organizationId: this.orgIdOrThrow(user),
      actorUserId,
      action,
      entityType,
      from,
      to,
      skip: Number(skip),
      take: Math.min(200, Number(take)),
    });
  }

  private orgIdOrThrow(user: VerifiedAuth | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException("Missing tenant claim in JWT");
    }
    return user.tenantId;
  }
}
