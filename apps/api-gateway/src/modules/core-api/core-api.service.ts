/**
 * apps/api-gateway/src/modules/core-api/core-api.service.ts
 *
 * Helper service: bridge to core-api for misc queries (e.g. public event lookup
 * by id) that don't fit a dedicated module. Uses gRPC core-client.
 */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Metadata } from "@grpc/grpc-js";
import { unary } from "../grpc/grpc-core-client";

const EVENT_SERVICE = "/saas_checkin.event.v1.EventService";

@Injectable()
export class CoreApiService {
  private readonly logger = new Logger(CoreApiService.name);

  /**
   * Public event detail (no tenant header — uses "anonymous" tenant for read).
   * For BFF public routes, this is only the event metadata; ticket types are
   * fetched separately via RegistrationService.listTicketTypes.
   */
  async getPublicEvent(eventId: string): Promise<unknown> {
    // Phase 3: use gRPC GetEvent with empty tenant (server allows public read
    // on published events via special case). For now, fetch from REST.
    // TODO: convert to gRPC when public event RPC is added.
    const res = await fetch(`${process.env.CORE_API_BASE ?? "http://localhost:5050"}/v1/events/${eventId}`);
    if (res.status === 404) throw new NotFoundException("Event not found");
    if (!res.ok) throw new Error(`core-api get event failed: ${res.status}`);
    return res.json();
  }
}
