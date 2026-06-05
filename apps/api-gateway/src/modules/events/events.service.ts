/**
 * apps/api-gateway/src/modules/events/events.service.ts — I-202
 *
 * BFF bridge to core-api EventService (gRPC or REST). Caches GET /events/{id}
 * in Redis 5 min, invalidates on mutation.
 */
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "../_shared/redis/redis.module";

const CACHE_TTL_SECONDS = 5 * 60;
const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

export interface EventDto {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  status: "draft" | "published" | "cancelled" | "completed";
  soldTickets: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async create(organizationId: string, body: unknown): Promise<EventDto> {
    const res = await fetch(`${CORE_API_BASE}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": organizationId },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`core-api create event failed: ${res.status} ${await res.text()}`);
    }
    const created = (await res.json()) as EventDto;
    await this.invalidateCache(organizationId, created.id);
    return created;
  }

  async list(organizationId: string, params: { status?: string; skip: number; take: number }): Promise<EventDto[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    qs.set("skip", String(params.skip));
    qs.set("take", String(params.take));
    const res = await fetch(`${CORE_API_BASE}/v1/events?${qs.toString()}`, {
      headers: { "X-Tenant-Id": organizationId },
    });
    if (!res.ok) {
      throw new Error(`core-api list events failed: ${res.status}`);
    }
    return (await res.json()) as EventDto[];
  }

  async findOne(organizationId: string, eventId: string): Promise<EventDto> {
    // Read-through cache
    const cacheKey = this.eventKey(organizationId, eventId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`cache hit: ${cacheKey}`);
      return JSON.parse(cached) as EventDto;
    }

    const res = await fetch(`${CORE_API_BASE}/v1/events/${eventId}`, {
      headers: { "X-Tenant-Id": organizationId },
    });
    if (res.status === 404) throw new NotFoundException("Event not found");
    if (!res.ok) throw new Error(`core-api find event failed: ${res.status}`);

    const event = (await res.json()) as EventDto;
    await this.redis.set(cacheKey, JSON.stringify(event), "EX", CACHE_TTL_SECONDS);
    return event;
  }

  async update(organizationId: string, eventId: string, body: unknown): Promise<EventDto> {
    const res = await fetch(`${CORE_API_BASE}/v1/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": organizationId },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`core-api update event failed: ${res.status} ${await res.text()}`);
    }
    const updated = (await res.json()) as EventDto;
    await this.invalidateCache(organizationId, eventId);
    return updated;
  }

  async publish(organizationId: string, eventId: string): Promise<EventDto> {
    const res = await fetch(`${CORE_API_BASE}/v1/events/${eventId}/publish`, {
      method: "POST",
      headers: { "X-Tenant-Id": organizationId },
    });
    if (!res.ok) throw new Error(`publish failed: ${res.status}`);
    const updated = (await res.json()) as EventDto;
    await this.invalidateCache(organizationId, eventId);
    return updated;
  }

  async cancel(organizationId: string, eventId: string): Promise<EventDto> {
    const res = await fetch(`${CORE_API_BASE}/v1/events/${eventId}/cancel`, {
      method: "POST",
      headers: { "X-Tenant-Id": organizationId },
    });
    if (!res.ok) throw new Error(`cancel failed: ${res.status}`);
    const updated = (await res.json()) as EventDto;
    await this.invalidateCache(organizationId, eventId);
    return updated;
  }

  private eventKey(orgId: string, eventId: string): string {
    return `event:${orgId}:${eventId}`;
  }

  private async invalidateCache(orgId: string, eventId: string): Promise<void> {
    await this.redis.del(this.eventKey(orgId, eventId));
  }
}
