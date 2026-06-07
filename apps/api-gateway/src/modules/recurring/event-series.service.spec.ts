/**
 * apps/api-gateway/src/modules/recurring/event-series.service.spec.ts
 */
import { beforeEach, describe, expect, it } from "vitest";
import { EventSeriesService, InMemoryEventSeriesStore } from "./event-series.service";
import type { EventSeriesInput } from "./rrule.types";

const tenant = (i = 0) => `tenant_${i + 1}`;

const baseInput = (overrides: Partial<EventSeriesInput> = {}): EventSeriesInput => ({
  name: "Weekly standup",
  templateEventId: "evt_template_1",
  rule: { freq: "WEEKLY", byDay: ["MO", "WE", "FR"] },
  startTimeLocal: "09:00",
  durationMinutes: 30,
  timezone: "Asia/Ho_Chi_Minh",
  ...overrides,
});

describe("EventSeriesService", () => {
  let store: InMemoryEventSeriesStore;
  let service: EventSeriesService;

  beforeEach(() => {
    store = new InMemoryEventSeriesStore();
    service = new EventSeriesService(store);
  });

  it("creates a series with stamped occurrences", async () => {
    const s = await service.create(tenant(), baseInput(), "2026-06-01T02:00:00.000Z");
    expect(s.id).toBeTruthy();
    expect(s.occurrences?.length).toBeGreaterThan(0);
    expect(s.occurrences?.[0].seriesId).toBe(s.id);
  });

  it("rejects invalid start time", async () => {
    await expect(
      service.create(tenant(), baseInput({ startTimeLocal: "9am" }), "2026-06-01T02:00:00.000Z"),
    ).rejects.toThrow(/startTimeLocal/);
  });

  it("rejects duration out of range", async () => {
    await expect(
      service.create(tenant(), baseInput({ durationMinutes: 1 }), "2026-06-01T02:00:00.000Z"),
    ).rejects.toThrow(/durationMinutes/);
  });

  it("rejects invalid timezone", async () => {
    await expect(
      service.create(tenant(), baseInput({ timezone: "123 invalid" }), "2026-06-01T02:00:00.000Z"),
    ).rejects.toThrow(/timezone/);
  });

  it("rejects rule with count + until", async () => {
    await expect(
      service.create(
        tenant(),
        baseInput({ rule: { freq: "DAILY", count: 5, until: "20260101T000000Z" } }),
        "2026-06-01T02:00:00.000Z",
      ),
    ).rejects.toThrow(/mutually exclusive/);
  });

  it("rejects BYDAY on non-WEEKLY", async () => {
    await expect(
      service.create(
        tenant(),
        baseInput({ rule: { freq: "DAILY", byDay: ["MO"] } }),
        "2026-06-01T02:00:00.000Z",
      ),
    ).rejects.toThrow(/BYDAY/);
  });

  it("lists occurrences for series", async () => {
    const s = await service.create(tenant(), baseInput(), "2026-06-01T02:00:00.000Z");
    const occ = await service.listOccurrences(s.id, tenant());
    expect(occ.length).toBe(s.occurrences?.length);
  });

  it("rejects list for wrong tenant", async () => {
    const s = await service.create(tenant(), baseInput(), "2026-06-01T02:00:00.000Z");
    await expect(service.listOccurrences(s.id, "other")).rejects.toThrow(/not found/);
  });

  it("removes series", async () => {
    const s = await service.create(tenant(), baseInput(), "2026-06-01T02:00:00.000Z");
    await service.remove(s.id, tenant());
    await expect(service.listOccurrences(s.id, tenant())).rejects.toThrow(/not found/);
  });

  it("parses raw RRULE string via helper", () => {
    const r = service.parseRRuleString("RRULE:FREQ=MONTHLY;BYMONTHDAY=1;COUNT=12");
    expect(r.freq).toBe("MONTHLY");
    expect(r.byMonthDay).toEqual([1]);
  });
});
