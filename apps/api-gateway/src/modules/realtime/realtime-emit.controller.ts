/**
 * apps/api-gateway/src/modules/realtime/realtime-emit.controller.ts
 *
 * Webhook từ .NET core-api (AttendeeCheckedInIntegrationEvent) -> emit tới
 * Socket.IO namespace. Auth: internal API key, không expose ra ngoài.
 */
import { Body, Controller, ForbiddenException, Headers, Post } from "@nestjs/common";
import { EventCheckinGateway } from "./gateways/event-checkin.gateway";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

@Controller("v1/realtime")
export class RealtimeEmitController {
  constructor(private readonly gateway: EventCheckinGateway) {}

  @Post("emit/attendee-checked-in")
  async emitAttendeeCheckedIn(
    @Headers("x-internal-key") key: string,
    @Body() body: { organizationId: string; eventId: string; payload: unknown },
  ) {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
    await this.gateway.emitAttendeeCheckedIn(body);
    return { emitted: true };
  }

  @Post("emit/check-in-rejected")
  async emitCheckInRejected(
    @Headers("x-internal-key") key: string,
    @Body() body: { organizationId: string; eventId: string; payload: unknown },
  ) {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
    await this.gateway.emitCheckInRejected(body);
    return { emitted: true };
  }

  @Post("emit/stats")
  async emitStats(
    @Headers("x-internal-key") key: string,
    @Body() body: { organizationId: string; eventId: string; count: number },
  ) {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
    await this.gateway.emitStatsUpdated(body);
    return { emitted: true };
  }
}
