/**
 * apps/api-gateway/src/modules/billing/subscription/subscription.controller.ts
 *
 * I-501 — REST endpoints for subscription management.
 *   - GET    /v1/billing/subscriptions/current
 *   - GET    /v1/billing/plans
 *   - POST   /v1/billing/subscriptions/upgrade
 *   - POST   /v1/billing/subscriptions/cancel
 */
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SubscriptionService, type PlanDto, type SubscriptionDto } from "./subscription.service";

@ApiTags("billing")
@Controller("v1/billing")
export class SubscriptionController {
  constructor(private readonly sub: SubscriptionService) {}

  @Get("subscriptions/current")
  @ApiOperation({ summary: "Get current subscription for the authenticated organization" })
  async current(@Query("organizationId") organizationId: string): Promise<SubscriptionDto | null> {
    return this.sub.getCurrent(organizationId);
  }

  @Get("plans")
  @ApiOperation({ summary: "List available plans" })
  async plans(): Promise<PlanDto[]> {
    return this.sub.listPlans();
  }

  @Post("subscriptions/upgrade")
  @ApiOperation({ summary: "Upgrade to a different plan" })
  async upgrade(
    @Body() body: { organizationId: string; newPlanId: string },
  ): Promise<{ ok: true }> {
    await this.sub.upgrade(body.organizationId, body.newPlanId);
    return { ok: true };
  }

  @Post("subscriptions/cancel")
  @ApiOperation({ summary: "Cancel current subscription" })
  async cancel(
    @Body() body: { organizationId: string; actorUserId: string },
  ): Promise<{ ok: true }> {
    await this.sub.cancel(body.organizationId, body.actorUserId);
    return { ok: true };
  }

  @Get("usage")
  @ApiOperation({ summary: "Get usage meter for current plan" })
  async usage(@Query("organizationId") organizationId: string): Promise<unknown> {
    return this.sub.getUsage(organizationId);
  }

  @Get("invoices")
  @ApiOperation({ summary: "List invoices for organization" })
  async invoices(
    @Query("organizationId") organizationId: string,
    @Query("skip") skip = "0",
    @Query("take") take = "20",
  ): Promise<unknown> {
    return this.sub.listInvoices(organizationId, Number(skip), Number(take));
  }
}
