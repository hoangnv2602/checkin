/**
 * apps/api-gateway/src/modules/notification/chat-config.controller.ts
 *
 * I-802 — Internal API cho web/admin set/update tenant chat config.
 * Auth: x-internal-key header.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Put,
} from "@nestjs/common";
import { ChatConfigService, type ChatConfig } from "./chat-config.service";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

@Controller("v1/internal/chat-config")
export class ChatConfigController {
  constructor(private readonly config: ChatConfigService) {}

  private assertKey(key: string): void {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
  }

  @Get(":tenantId")
  async get(
    @Param("tenantId") tenantId: string,
    @Headers("x-internal-key") key: string,
  ): Promise<{ tenantId: string; config: ChatConfig | null }> {
    this.assertKey(key);
    return { tenantId, config: await this.config.get(tenantId) };
  }

  @Put(":tenantId")
  async set(
    @Param("tenantId") tenantId: string,
    @Headers("x-internal-key") key: string,
    @Body() body: { provider: "slack" | "discord"; webhookUrl: string; defaultChannel?: string },
  ): Promise<{ ok: true; config: ChatConfig }> {
    this.assertKey(key);
    if (!body.provider || !["slack", "discord"].includes(body.provider)) {
      throw new BadRequestException("provider must be slack or discord");
    }
    if (!body.webhookUrl || !body.webhookUrl.startsWith("https://")) {
      throw new BadRequestException("webhookUrl must be https");
    }
    const cfg: ChatConfig = {
      provider: body.provider,
      webhookUrl: body.webhookUrl,
      defaultChannel: body.defaultChannel,
      createdAt: new Date().toISOString(),
    };
    await this.config.set(tenantId, cfg);
    return { ok: true, config: cfg };
  }

  @Delete(":tenantId")
  async remove(
    @Param("tenantId") tenantId: string,
    @Headers("x-internal-key") key: string,
  ): Promise<{ ok: true }> {
    this.assertKey(key);
    await this.config.delete(tenantId);
    return { ok: true };
  }
}
