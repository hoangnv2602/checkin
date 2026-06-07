/**
 * apps/api-gateway/src/modules/recurring/event-series.service.ts
 *
 * I-904 — Event series service: in-memory store + occurrence generation.
 * Forward to core-api for persistence in Phase 10 (now return data structure
 * cho controller trả về).
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { generateOccurrences, parseRRule, validateRRule } from "./rrule";
import { serializeRRule } from "./rrule";
import { RRULE_VALIDATION, type EventOccurrence, type EventSeries, type EventSeriesInput, type RRule } from "./rrule.types";

export interface IEventSeriesStore {
  listByTenant(tenantId: string): Promise<EventSeries[]>;
  get(id: string): Promise<EventSeries | null>;
  create(tenantId: string, input: EventSeriesInput, dtStart: string, occurrences: EventOccurrence[]): Promise<EventSeries>;
  delete(id: string, tenantId: string): Promise<boolean>;
}

@Injectable()
export class InMemoryEventSeriesStore implements IEventSeriesStore {
  private readonly logger = new Logger(InMemoryEventSeriesStore.name);
  private readonly store = new Map<string, EventSeries>();
  private idCounter = 0;

  private nextId(): string {
    this.idCounter += 1;
    return `series_${Date.now().toString(36)}_${this.idCounter.toString(36)}`;
  }
  async listByTenant(tenantId: string): Promise<EventSeries[]> {
    return [...this.store.values()].filter((s) => s.tenantId === tenantId);
  }
  async get(id: string): Promise<EventSeries | null> {
    return this.store.get(id) ?? null;
  }
  async create(tenantId: string, input: EventSeriesInput, _dtStart: string, occurrences: EventOccurrence[]): Promise<EventSeries> {
    const now = new Date().toISOString();
    const series: EventSeries = {
      id: this.nextId(),
      tenantId,
      name: input.name,
      templateEventId: input.templateEventId,
      rule: input.rule,
      startTimeLocal: input.startTimeLocal,
      durationMinutes: input.durationMinutes,
      timezone: input.timezone,
      exDates: input.exDates ?? [],
      occurrences,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(series.id, series);
    this.logger.log(`series created ${series.id} tenant=${tenantId} rule=${serializeRRule(input.rule)} occurrences=${occurrences.length}`);
    return series;
  }
  async delete(id: string, tenantId: string): Promise<boolean> {
    const s = this.store.get(id);
    if (!s || s.tenantId !== tenantId) return false;
    this.store.delete(id);
    return true;
  }
}

@Injectable()
export class EventSeriesService {
  private readonly logger = new Logger(EventSeriesService.name);

  constructor(private readonly store: IEventSeriesStore) {}

  async create(tenantId: string, input: EventSeriesInput, dtStart: string): Promise<EventSeries> {
    // Input validation
    if (!input.name || input.name.length > RRULE_VALIDATION.nameMaxLength) {
      throw new BadRequestException(`name max ${RRULE_VALIDATION.nameMaxLength} chars`);
    }
    if (!RRULE_VALIDATION.timePattern.test(input.startTimeLocal)) {
      throw new BadRequestException("startTimeLocal must be HH:MM");
    }
    if (input.durationMinutes < RRULE_VALIDATION.durationMinMinutes || input.durationMinutes > RRULE_VALIDATION.durationMaxMinutes) {
      throw new BadRequestException(`durationMinutes must be ${RRULE_VALIDATION.durationMinMinutes}..${RRULE_VALIDATION.durationMaxMinutes}`);
    }
    if (!RRULE_VALIDATION.timezonePattern.test(input.timezone)) {
      throw new BadRequestException("timezone invalid IANA format");
    }

    // Validate rule semantic
    const v = validateRRule(input.rule);
    if (!v.ok) throw new BadRequestException(v.reason);

    // Generate occurrences
    const occurrences = generateOccurrences(input.rule, dtStart, {
      maxOccurrences: 90,
      seriesId: "pending", // updated after create
      eventId: input.templateEventId,
      exDates: input.exDates,
    });
    if (occurrences.length === 0) {
      throw new BadRequestException("rule generated 0 occurrences in horizon");
    }

    const series = await this.store.create(tenantId, input, dtStart, occurrences);
    // Re-stamp occurrence IDs with real series ID
    const stamped: EventOccurrence[] = occurrences.map((o) => ({ ...o, seriesId: series.id }));
    series.occurrences = stamped;
    this.store.listByTenant(tenantId); // touch to keep method referenced
    return series;
  }

  async listOccurrences(id: string, tenantId: string): Promise<EventOccurrence[]> {
    const s = await this.store.get(id);
    if (!s || s.tenantId !== tenantId) throw new NotFoundException("series not found");
    return s.occurrences ?? [];
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const ok = await this.store.delete(id, tenantId);
    if (!ok) throw new NotFoundException("series not found");
  }

  /** Parse a raw RRULE string (RFC 5545) — used by API endpoint. */
  parseRRuleString(line: string): RRule {
    return parseRRule(line);
  }
}
