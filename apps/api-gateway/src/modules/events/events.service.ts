/**
 * apps/api-gateway/src/modules/events/events.service.ts — I-202 + I-201 wiring
 *
 * BFF bridge to core-api EventService + VenueService qua gRPC (port 50051).
 * Redis cache GET /events/{id} 5 min, invalidates on mutation.
 *
 * Request/response shape match raw POCO message types defined trong
 * apps/core-api/src/SaasCheckin.HttpApi.Host/Grpc/EventGrpcService.cs (Phase 2
 * stand-in cho proto-generated).
 */
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type Redis from "ioredis";
import { Metadata } from "@grpc/grpc-js";
import { REDIS } from "../_shared/redis/redis.module";
import { unary } from "../grpc/grpc-core-client";

const CACHE_TTL_SECONDS = 5 * 60;
const EVENTS_SERVICE = "/saas_checkin.event.v1.EventService";
const VENUES_SERVICE = "/saas_checkin.event.v1.VenueService";

export const EventMethod = {
  ListEvents: `${EVENTS_SERVICE}/ListEvents`,
  GetEvent: `${EVENTS_SERVICE}/GetEvent`,
  CreateEvent: `${EVENTS_SERVICE}/CreateEvent`,
  UpdateEvent: `${EVENTS_SERVICE}/UpdateEvent`,
  PublishEvent: `${EVENTS_SERVICE}/PublishEvent`,
  CancelEvent: `${EVENTS_SERVICE}/CancelEvent`,
  CompleteEvent: `${EVENTS_SERVICE}/CompleteEvent`,
  ListSessions: `${EVENTS_SERVICE}/ListSessions`,
  AddSession: `${EVENTS_SERVICE}/AddSession`,
  UpdateSession: `${EVENTS_SERVICE}/UpdateSession`,
  ChangeSessionStatus: `${EVENTS_SERVICE}/ChangeSessionStatus`,
} as const;

export const VenueMethod = {
  ListVenues: `${VENUES_SERVICE}/ListVenues`,
  AddVenue: `${VENUES_SERVICE}/AddVenue`,
  UpdateVenue: `${VENUES_SERVICE}/UpdateVenue`,
  ChangeVenueStatus: `${VENUES_SERVICE}/ChangeVenueStatus`,
} as const;

export interface EventDto {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  capacity: number;
  soldTickets: number;
  status: "draft" | "published" | "cancelled" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface VenueDto {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  address: {
    country: string;
    streetLine1: string;
    streetLine2: string;
    city: string;
    region: string;
    postalCode: string;
  };
  capacity: number;
  hasGeo: boolean;
  latitude: number;
  longitude: number;
  status: "active" | "inactive" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface SessionDto {
  id: string;
  organizationId: string;
  eventId: string;
  venueId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  capacity: number;
  status: "draft" | "scheduled" | "started" | "ended" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private tenantMetadata(organizationId: string): Metadata {
    const md = new Metadata();
    md.add("x-tenant-id", organizationId);
    return md;
  }

  // ============ EVENT ============

  async list(organizationId: string, params: { status?: string; skip: number; take: number }): Promise<EventDto[]> {
    const req = {
      organizationId,
      status: params.status ?? "",
      skip: params.skip,
      take: params.take,
    };
    const res = await unary<typeof req, { events: EventDto[] }>(EventMethod.ListEvents, req, this.tenantMetadata(organizationId));
    return res.events;
  }

  async findOne(organizationId: string, eventId: string): Promise<EventDto> {
    const cacheKey = this.eventKey(organizationId, eventId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`cache hit: ${cacheKey}`);
      return JSON.parse(cached) as EventDto;
    }
    try {
      const event = await unary<{ organizationId: string; eventId: string }, EventDto>(
        EventMethod.GetEvent,
        { organizationId, eventId },
        this.tenantMetadata(organizationId),
      );
      await this.redis.set(cacheKey, JSON.stringify(event), "EX", CACHE_TTL_SECONDS);
      return event;
    } catch (err) {
      if (isGrpcNotFound(err)) throw new NotFoundException("Event not found");
      throw err;
    }
  }

  async create(organizationId: string, body: {
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    capacity: number;
  }): Promise<EventDto> {
    const event = await unary<typeof body & { organizationId: string }, EventDto>(
      EventMethod.CreateEvent,
      { ...body, organizationId, description: body.description ?? "" },
      this.tenantMetadata(organizationId),
    );
    await this.invalidateCache(organizationId, event.id);
    return event;
  }

  async update(organizationId: string, eventId: string, body: {
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string;
    capacity?: number;
  }): Promise<EventDto> {
    const req = {
      organizationId,
      eventId,
      title: body.title ?? "",
      description: body.description ?? "",
      startAt: body.startAt ?? "",
      endAt: body.endAt ?? "",
      capacity: body.capacity ?? 0,
      clearDescription: body.description === null,
    };
    const event = await unary<typeof req, EventDto>(EventMethod.UpdateEvent, req, this.tenantMetadata(organizationId));
    await this.invalidateCache(organizationId, eventId);
    return event;
  }

  async publish(organizationId: string, eventId: string): Promise<EventDto> {
    const event = await unary<{ organizationId: string; eventId: string }, EventDto>(
      EventMethod.PublishEvent,
      { organizationId, eventId },
      this.tenantMetadata(organizationId),
    );
    await this.invalidateCache(organizationId, eventId);
    return event;
  }

  async cancel(organizationId: string, eventId: string): Promise<EventDto> {
    const event = await unary<{ organizationId: string; eventId: string }, EventDto>(
      EventMethod.CancelEvent,
      { organizationId, eventId },
      this.tenantMetadata(organizationId),
    );
    await this.invalidateCache(organizationId, eventId);
    return event;
  }

  async complete(organizationId: string, eventId: string): Promise<EventDto> {
    const event = await unary<{ organizationId: string; eventId: string }, EventDto>(
      EventMethod.CompleteEvent,
      { organizationId, eventId },
      this.tenantMetadata(organizationId),
    );
    await this.invalidateCache(organizationId, eventId);
    return event;
  }

  // ============ SESSION ============

  async listSessions(organizationId: string, eventId: string, skip: number, take: number): Promise<SessionDto[]> {
    const res = await unary<{ organizationId: string; eventId: string; skip: number; take: number }, { sessions: SessionDto[] }>(
      EventMethod.ListSessions,
      { organizationId, eventId, skip, take },
      this.tenantMetadata(organizationId),
    );
    return res.sessions;
  }

  async addSession(organizationId: string, eventId: string, body: {
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    capacity: number;
    venueId?: string;
  }): Promise<SessionDto> {
    return unary<typeof body & { organizationId: string; eventId: string }, SessionDto>(
      EventMethod.AddSession,
      { ...body, organizationId, eventId, description: body.description ?? "", venueId: body.venueId ?? "" },
      this.tenantMetadata(organizationId),
    );
  }

  // ============ VENUE ============

  async listVenues(organizationId: string, params: { status?: string; skip: number; take: number }): Promise<VenueDto[]> {
    const req = { organizationId, status: params.status ?? "", skip: params.skip, take: params.take };
    const res = await unary<typeof req, { venues: VenueDto[] }>(VenueMethod.ListVenues, req, this.tenantMetadata(organizationId));
    return res.venues;
  }

  async addVenue(organizationId: string, body: {
    name: string;
    description?: string;
    country: string;
    streetLine1?: string;
    streetLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    capacity?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<VenueDto> {
    const req = {
      organizationId,
      name: body.name,
      description: body.description ?? "",
      address: {
        country: body.country,
        streetLine1: body.streetLine1 ?? "",
        streetLine2: body.streetLine2 ?? "",
        city: body.city ?? "",
        region: body.region ?? "",
        postalCode: body.postalCode ?? "",
      },
      capacity: body.capacity ?? 0,
      latitude: body.latitude ?? 0,
      longitude: body.longitude ?? 0,
      hasGeo: body.latitude !== undefined && body.longitude !== undefined,
      clearDescription: body.description === null,
    };
    return unary<typeof req, VenueDto>(VenueMethod.AddVenue, req, this.tenantMetadata(organizationId));
  }

  // ============ Cache helpers ============

  private eventKey(orgId: string, eventId: string): string {
    return `event:${orgId}:${eventId}`;
  }

  private async invalidateCache(orgId: string, eventId: string): Promise<void> {
    await this.redis.del(this.eventKey(orgId, eventId));
  }
}

function isGrpcNotFound(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: number; message?: string };
    if (e.code === 5 /* NOT_FOUND */) return true;
    if (typeof e.message === "string" && /not found/i.test(e.message)) return true;
  }
  return false;
}
