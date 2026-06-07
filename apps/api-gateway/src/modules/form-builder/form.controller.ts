/**
 * apps/api-gateway/src/modules/form-builder/form.controller.ts
 *
 * I-903 — REST endpoints cho form templates + public submission schema.
 *
 * Auth: JwtAuthGuard. `tenantId` + `plan` từ req.user (Phase 9: read từ
 * `x-tenant-id` header trong test). `JwtAuthGuard` đã được apply global
 * ở AppModule — controller không cần `@UseGuards`.
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
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { FormService } from "./form.service";
import type { FormTemplate, FormTemplateInput, FormTemplateUpdate } from "./form.types";

interface AuthedRequest extends Request {
  user: { tenantId?: string; sub?: string; plan?: string };
}

function tenantOrThrow(req: AuthedRequest): string {
  const t = req.user?.tenantId ?? (req.headers as Record<string, string | undefined>)["x-tenant-id"];
  if (!t) throw new BadRequestException("missing tenant context");
  return t;
}
function planOf(req: AuthedRequest): string {
  return req.user?.plan ?? (req.headers as Record<string, string | undefined>)["x-tenant-plan"] ?? "free";
}

@Controller("v1/forms")
export class FormController {
  constructor(private readonly service: FormService) {}

  @Get()
  async list(@Req() req: AuthedRequest): Promise<{ items: FormTemplate[] }> {
    return { items: await this.service.list(tenantOrThrow(req)) };
  }

  @Post()
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: FormTemplateInput,
  ): Promise<FormTemplate> {
    return this.service.create(tenantOrThrow(req), body, planOf(req));
  }

  @Patch(":id")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: FormTemplateUpdate,
  ): Promise<FormTemplate> {
    return this.service.update(id, tenantOrThrow(req), body, planOf(req));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param("id") id: string): Promise<void> {
    await this.service.remove(id, tenantOrThrow(req));
  }

  @Get("by-event/:eventId")
  async getByEvent(
    @Req() req: AuthedRequest,
    @Param("eventId") eventId: string,
  ): Promise<{ template: FormTemplate; jsonSchema: unknown }> {
    const tpl = await this.service.getByEvent(tenantOrThrow(req), eventId);
    return { template: tpl, jsonSchema: null };
  }

  @Get(":id/schema")
  async exportSchema(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ): Promise<unknown> {
    return this.service.exportJsonSchema(id, tenantOrThrow(req));
  }
}

/**
 * Public controller — dùng cho public registration form (attendee submit).
 * Tenant id lấy từ custom-domain resolver (I-804) hoặc path param.
 */
@Controller("public/forms")
export class FormPublicController {
  constructor(private readonly service: FormService) {}

  @Get("by-event/:tenantId/:eventId")
  async getPublicForm(
    @Param("tenantId") tenantId: string,
    @Param("eventId") eventId: string,
  ): Promise<{ template: FormTemplate; jsonSchema: unknown } | null> {
    const result = await this.service.getPublicByEvent(tenantId, eventId);
    if (!result) return null;
    return { template: result.template, jsonSchema: result.jsonSchema };
  }

  @Post("by-event/:tenantId/:eventId/validate")
  @HttpCode(200)
  async validate(
    @Param("tenantId") tenantId: string,
    @Param("eventId") eventId: string,
    @Body() body: { values: Record<string, unknown> },
  ): Promise<{ ok: boolean; errors: Record<string, string> }> {
    const tpl = await this.service.getPublicByEvent(tenantId, eventId);
    if (!tpl) throw new BadRequestException("no active form for event");
    return this.service.validatePayload(tpl.template, body.values ?? {});
  }
}
