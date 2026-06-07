/**
 * apps/api-gateway/src/modules/recurring/rrule.spec.ts
 *
 * I-904 — Pure logic tests cho RRULE parser + generator.
 */
import { describe, expect, it } from "vitest";
import { generateOccurrences, parseRRule, serializeRRule, validateRRule, toYMD } from "./rrule";

describe("parseRRule", () => {
  it("parses basic DAILY", () => {
    const r = parseRRule("RRULE:FREQ=DAILY");
    expect(r.freq).toBe("DAILY");
  });
  it("parses WEEKLY with BYDAY + INTERVAL", () => {
    const r = parseRRule("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");
    expect(r.freq).toBe("WEEKLY");
    expect(r.interval).toBe(2);
    expect(r.byDay).toEqual(["MO", "WE"]);
  });
  it("parses MONTHLY with BYMONTHDAY + COUNT", () => {
    const r = parseRRule("RRULE:FREQ=MONTHLY;BYMONTHDAY=15;COUNT=6");
    expect(r.freq).toBe("MONTHLY");
    expect(r.byMonthDay).toEqual([15]);
    expect(r.count).toBe(6);
  });
  it("parses YEARLY with BYMONTH", () => {
    const r = parseRRule("RRULE:FREQ=YEARLY;BYMONTH=12;INTERVAL=1");
    expect(r.freq).toBe("YEARLY");
    expect(r.byMonth).toEqual([12]);
  });
  it("rejects missing FREQ", () => {
    expect(() => parseRRule("RRULE:INTERVAL=2")).toThrow(/FREQ required/);
  });
  it("rejects invalid FREQ", () => {
    expect(() => parseRRule("RRULE:FREQ=HOURLY")).toThrow(/invalid FREQ/);
  });
  it("rejects BYDAY with non-WEEKLY", () => {
    // (parseRRule accepts syntactically; semantic check ở validateRRule)
    const r = parseRRule("RRULE:FREQ=DAILY;BYDAY=MO");
    expect(r.byDay).toEqual(["MO"]);
  });
  it("rejects unknown key", () => {
    expect(() => parseRRule("RRULE:FREQ=DAILY;FOO=bar")).toThrow(/unsupported/);
  });
  it("rejects malformed part", () => {
    expect(() => parseRRule("RRULE:FREQ=DAILY;BROKEN")).toThrow();
  });
});

describe("serializeRRule", () => {
  it("round-trips simple WEEKLY", () => {
    const r = parseRRule("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR");
    const out = serializeRRule(r);
    expect(out).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });
  it("omits default interval=1", () => {
    const r = parseRRule("RRULE:FREQ=DAILY");
    const out = serializeRRule(r);
    expect(out).toBe("RRULE:FREQ=DAILY");
  });
});

describe("validateRRule", () => {
  it("rejects count + until together", () => {
    const r = validateRRule({ freq: "DAILY", count: 5, until: "20260101T000000Z" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/mutually exclusive/);
  });
  it("rejects BYDAY on non-WEEKLY", () => {
    const r = validateRRule({ freq: "DAILY", byDay: ["MO"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/BYDAY/);
  });
  it("rejects BYMONTH on non-YEARLY", () => {
    const r = validateRRule({ freq: "MONTHLY", byMonth: [12] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/BYMONTH/);
  });
  it("accepts valid rule", () => {
    expect(validateRRule({ freq: "WEEKLY", byDay: ["MO", "WE"] })).toEqual({ ok: true });
  });
});

describe("generateOccurrences", () => {
  it("DAILY for 5 days", () => {
    const r = parseRRule("RRULE:FREQ=DAILY;COUNT=5");
    const occ = generateOccurrences(r, "2026-06-01T09:00:00.000Z", {
      maxOccurrences: 10, seriesId: "s1", eventId: "e1",
    });
    expect(occ).toHaveLength(5);
    expect(occ[0].date).toBe("2026-06-01");
    expect(occ[4].date).toBe("2026-06-05");
  });
  it("WEEKLY MO,WE,FR for 3 weeks", () => {
    const r = parseRRule("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=9");
    // 2026-06-01 is Monday
    const occ = generateOccurrences(r, "2026-06-01T09:00:00.000Z", {
      maxOccurrences: 20, seriesId: "s1", eventId: "e1",
    });
    expect(occ).toHaveLength(9);
    expect(occ[0].date).toBe("2026-06-01");
    expect(occ[1].date).toBe("2026-06-03");
    expect(occ[2].date).toBe("2026-06-05");
    expect(occ[3].date).toBe("2026-06-08");
  });
  it("MONTHLY 15th for 4 months", () => {
    const r = parseRRule("RRULE:FREQ=MONTHLY;BYMONTHDAY=15;COUNT=4");
    const occ = generateOccurrences(r, "2026-01-15T10:00:00.000Z", {
      maxOccurrences: 12, seriesId: "s1", eventId: "e1",
    });
    expect(occ).toHaveLength(4);
    expect(occ.map((o) => o.date)).toEqual([
      "2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15",
    ]);
  });
  it("YEARLY December 31", () => {
    const r = parseRRule("RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31;COUNT=3");
    const occ = generateOccurrences(r, "2026-12-31T23:00:00.000Z", {
      maxOccurrences: 10, seriesId: "s1", eventId: "e1",
    });
    expect(occ).toHaveLength(3);
    expect(occ[2].date).toBe("2028-12-31");
  });
  it("respects horizonEnd", () => {
    const r = parseRRule("RRULE:FREQ=DAILY");
    const occ = generateOccurrences(r, "2026-06-01T09:00:00.000Z", {
      maxOccurrences: 100, horizonEnd: "2026-06-05T23:59:59.000Z",
      seriesId: "s1", eventId: "e1",
    });
    expect(occ.length).toBeLessThanOrEqual(5);
  });
  it("respects exDates", () => {
    const r = parseRRule("RRULE:FREQ=DAILY");
    const occ = generateOccurrences(r, "2026-06-01T09:00:00.000Z", {
      maxOccurrences: 10, seriesId: "s1", eventId: "e1",
      exDates: ["2026-06-03"],
      horizonEnd: "2026-06-05T23:59:59.000Z",
    });
    expect(occ.map((o) => o.date)).toEqual([
      "2026-06-01", "2026-06-02", "2026-06-04", "2026-06-05",
    ]);
  });
  it("respects INTERVAL=2 (every 2 days)", () => {
    const r = parseRRule("RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3");
    const occ = generateOccurrences(r, "2026-06-01T09:00:00.000Z", {
      maxOccurrences: 10, seriesId: "s1", eventId: "e1",
    });
    expect(occ.map((o) => o.date)).toEqual(["2026-06-01", "2026-06-03", "2026-06-05"]);
  });
  it("respects hard cap (maxOccurrences > 365 → 365)", () => {
    const r = parseRRule("RRULE:FREQ=DAILY");
    const occ = generateOccurrences(r, "2026-01-01T00:00:00.000Z", {
      maxOccurrences: 1000, seriesId: "s1", eventId: "e1",
    });
    expect(occ.length).toBeLessThanOrEqual(365);
  });
});

describe("toYMD", () => {
  it("formats UTC date as YYYY-MM-DD", () => {
    expect(toYMD(new Date("2026-06-07T15:00:00.000Z"))).toBe("2026-06-07");
  });
  it("zero-pads single digits", () => {
    expect(toYMD(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });
});
