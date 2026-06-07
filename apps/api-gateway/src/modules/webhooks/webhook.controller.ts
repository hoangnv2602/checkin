/**
 * apps/api-gateway/src/modules/webhooks/webhook.controller.ts
 *
 * I-901 — REST endpoints cho tenant webhook subscriptions + deliveries.
 *
 * Routes (all under /v1/webhooks):
 *   GET    /                    → list subscriptions
 *   POST   /                    → create (returns plaintext secret one-time)
 *   PATCH  /:id                 → update (url/events/active/description)
 *   DELETE /:id                 → delete
 *   POST   /:id/test            → send a test event synchronously
 *   GET    /deliveries          → recent delivery log
 *   POST   /deliveries/:id/replay → re-enqueue a failed delivery
 *
 * Auth: JwtAuthGuard đã check ở root app; controller đọc req.user để
 * lấy tenantId + plan. Phase 9 hardcode plan="pro" ở header nếu thiếu
 * (Phase 10 sẽ join membership).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { WebhookService } from "./webhook.service";
import type {
  WebhookEventType,
  WebhookSubscription,
  WebhookSubscriptionCreateInput,
} from "./webhook.types";

interface AuthedRequest extends Request {
  user: { tenantId?: string; sub?: string; plan?: string };
}

function tenantIdOrThrow(req: AuthedRequest): string {
  const tid = req.user?.tenantId ?? (req as unknown as { headers?: Record<string, string> }).headers?.["x-tenant-id"];
  if (!tid) {
    throw new BadRequestException("missing tenant context");
  }
  return tid;
}

function planOf(req: AuthedRequest): string {
  return req.user?.plan ?? (req as unknown as { headers?: Record<string, string> }).headers?.["x-tenant-plan"] ?? "free";
}

interface CreateBody {
  url: string;
  events: WebhookEventType[];
  description?: string;
  secret?: string;
}

interface UpdateBody {
  url?: string;
  events?: WebhookEventType[];
  active?: boolean;
  description?: string;
}

function stripSecret(s: WebhookSubscription): Omit<WebhookSubscription, "encryptedSecret"> {
  const { encryptedSecret: _drop, ...rest } = s;
  return rest;
}

@UseGuards(JwtAuthGuard)
@Controller("v1/webhooks")
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Get()
  async list(@Req() req: AuthedRequest): Promise<{ items: Omit<WebhookSubscription, "encryptedSecret">[] }> {
    const tid = tenantIdOrThrow(req);
    const items = await this.service.list(tid);
    return { items: items.map(stripSecret) };
  }

  @Post()
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: CreateBody,
  ): Promise<{ subscription: Omit<WebhookSubscription, "encryptedSecret">; secret: string }> {
    const tid = tenantIdOrThrow(req);
    const plan = planOf(req);
    const input: WebhookSubscriptionCreateInput = {
      url: body.url,
      events: body.events,
      description: body.description,
      secret: body.secret,
    };
    const sub = await this.service.create(tid, input, plan);
    const secret = this.service.revealSecret(sub);
    return { subscription: stripSecret(sub), secret };
  }

  @Patch(":id")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateBody,
  ): Promise<Omit<WebhookSubscription, "encryptedSecret">> {
    const tid = tenantIdOrThrow(req);
    const plan = planOf(req);
    const updated = await this.service.update(
      id,
      tid,
      {
        url: body.url,
        events: body.events,
        active: body.active,
        description: body.description,
      },
      plan,
    );
    return stripSecret(updated);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param("id") id: string): Promise<void> {
    const tid = tenantIdOrThrow(req);
    await this.service.remove(id, tid);
  }

  @Post(":id/test")
  @HttpCode(200)
  async sendTest(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body?: { eventType?: WebhookEventType; payload?: Record<string, unknown> },
  ): Promise<{ deliveryId: string; url: string; status: number; success: boolean; body?: string }> {
    const tid = tenantIdOrThrow(req);
    return this.service.sendTestEvent({
      subscriptionId: id,
      tenantId: tid,
      eventType: body?.eventType,
      payload: body?.payload,
    });
  }

  @Get("deliveries")
  async deliveries(
    @Req() req: AuthedRequest,
    @Query("limit") limit?: string,
  ): Promise<{ items: unknown[] }> {
    const tid = tenantIdOrThrow(req);
    const n = limit ? Number.parseInt(limit, 10) : 50;
    const items = await this.service.listDeliveries(tid, Number.isFinite(n) ? n : 50);
    return { items };
  }

  @Post("deliveries/:id/replay")
  @HttpCode(202)
  async replay(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ): Promise<{ ok: boolean }> {
    const tid = tenantIdOrThrow(req);
    const replayed = await this.service.replay(id, tid);
    return { ok: replayed !== null };
  }
}
