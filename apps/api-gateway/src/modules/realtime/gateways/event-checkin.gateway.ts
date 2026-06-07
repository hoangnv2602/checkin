/**
 * apps/api-gateway/src/modules/realtime/gateways/event-checkin.gateway.ts
 *
 * I-402 — Socket.IO namespace `event:{eventId}:checkin`. Mỗi event có
 * 1 namespace riêng; rooms `staff` (chỉ staff trong tenant) + `dashboard`
 * (full broadcast tới owner dashboard subscriber).
 *
 * JWT verify ở middleware: extract tenantId + userId + role. Reject
 * nếu user không có membership trong tenant.
 *
 * Throttle: emit `StatsUpdated` max 1 / 250ms / event để tránh flood
 * (consolidate qua StatsThrottler).
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Logger, OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { Redis } from "ioredis";
import { Inject, Optional } from "@nestjs/common";
import { REDIS } from "../../_shared/redis/redis.module";
import { StatsThrottler } from "./stats-throttler";

interface SocketData {
  userId: string;
  organizationId: string;
  role: string;
  eventId: string;
}

const NAMESPACE_PREFIX = "event:";
const NAMESPACE_SUFFIX = ":checkin";

@WebSocketGateway({
  namespace: /^\/event\/[a-f0-9-]+\/checkin$/,
  cors: { origin: "*" },
})
export class EventCheckinGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EventCheckinGateway.name);
  private readonly throttler = new StatsThrottler(250);

  constructor(
    private readonly jwt: JwtService,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  async onModuleInit() {
    // Adapter cross-instance — Redis pub/sub. Set ở main.ts (I-202 sẽ wire).
    this.logger.log("EventCheckinGateway ready (namespace regex)");
  }

  async handleConnection(socket: Socket) {
    try {
      const data = await this.authenticate(socket);
      (socket.data as SocketData) = data;
      await socket.join(this.dashboardRoom(data.eventId));
      await socket.join(this.staffRoom(data.organizationId, data.eventId));
      this.logger.log(
        `connected user=${data.userId} org=${data.organizationId} event=${data.eventId} role=${data.role}`,
      );
      socket.emit("ready", { eventId: data.eventId });
    } catch (err) {
      this.logger.warn(`reject connection: ${err instanceof Error ? err.message : err}`);
      socket.emit("error", { code: "unauthorized", message: String(err) });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const data = socket.data as SocketData | undefined;
    if (data) {
      this.logger.log(`disconnected user=${data.userId} event=${data.eventId}`);
    }
  }

  /**
   * Staff explicit subscribe — bỏ qua auto-subscribe ở connection.
   * Payload: { eventId }.
   */
  @SubscribeMessage("subscribe")
  async onSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { eventId: string },
  ) {
    const data = socket.data as SocketData;
    if (!data) throw new Error("unauthenticated");
    if (data.eventId !== body.eventId) throw new Error("event mismatch");
    return { ok: true, eventId: data.eventId };
  }

  /**
   * Server-side emit helpers — gọi từ webhook controller khi nhận
   * AttendeeCheckedInIntegrationEvent từ .NET core-api.
   */
  async emitAttendeeCheckedIn(input: {
    organizationId: string;
    eventId: string;
    payload: unknown;
  }): Promise<void> {
    const ns = this.server.of(this.namespaceFor(input.eventId));
    ns.to(this.dashboardRoom(input.eventId)).emit("AttendeeCheckedIn", input.payload);
  }

  async emitCheckInRejected(input: {
    organizationId: string;
    eventId: string;
    payload: unknown;
  }): Promise<void> {
    const ns = this.server.of(this.namespaceFor(input.eventId));
    ns.to(this.dashboardRoom(input.eventId)).emit("CheckInRejected", input.payload);
  }

  async emitStatsUpdated(input: {
    organizationId: string;
    eventId: string;
    count: number;
    totalRegistered?: number;
    checkInPercent?: number;
  }): Promise<void> {
    if (!this.throttler.shouldEmit(input.eventId)) return;
    const ns = this.server.of(this.namespaceFor(input.eventId));
    ns.to(this.dashboardRoom(input.eventId)).emit("StatsUpdated", {
      eventId: input.eventId,
      count: input.count,
      totalRegistered: input.totalRegistered ?? null,
      checkInPercent: input.checkInPercent ?? null,
      at: new Date().toISOString(),
    });
  }

  private async authenticate(socket: Socket): Promise<SocketData> {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined) ??
      this.extractBearerFromHeader(socket.handshake.headers.authorization);
    if (!token) throw new Error("missing token");

    const claims = await this.jwt.verifyAsync<{
      sub: string;
      organizationId: string;
      role: string;
      aud?: string;
    }>(token);
    if (claims.aud && claims.aud !== "tenant-web") {
      throw new Error("wrong audience");
    }

    const nsName = socket.nsp.name; // /event/{eventId}/checkin
    const match = nsName.match(/\/event\/([a-f0-9-]+)\/checkin$/);
    if (!match) throw new Error("invalid namespace");
    const eventId = match[1];

    if (claims.organizationId !== socket.handshake.query?.organizationId) {
      throw new Error("organizationId mismatch");
    }
    return {
      userId: claims.sub,
      organizationId: claims.organizationId,
      role: claims.role,
      eventId,
    };
  }

  private extractBearerFromHeader(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
    return token;
  }

  private namespaceFor(eventId: string): string {
    return `${NAMESPACE_PREFIX}${eventId}${NAMESPACE_SUFFIX}`;
  }

  private dashboardRoom(eventId: string): string {
    return `event:${eventId}:dashboard`;
  }

  private staffRoom(orgId: string, eventId: string): string {
    return `org:${orgId}:event:${eventId}:staff`;
  }
}
