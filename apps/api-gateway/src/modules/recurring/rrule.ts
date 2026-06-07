/**
 * apps/api-gateway/src/modules/recurring/rrule.ts
 *
 * I-904 — Pure RRULE parser + occurrence generator.
 *
 * `parseRRule(line: string)` — parse RFC 5545 RRULE line (e.g.
 *   "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10").
 * `generateOccurrences(rule, dtstart, options)` — generate next N dates
 *   theo rule.
 *
 * Không depend date-fns / luxon — dùng Date + manual weekday arithmetic.
 * Đủ đúng cho MVP (không xử lý DST transition phức tạp — occurrence
 * vẫn cùng local time, mình convert qua UTC với timezone offset
 * đã biết tại dtstart).
 */
import {
  ALL_RRULE_FREQS,
  ALL_WEEKDAYS,
  RRULE_HARD_CAP,
  RRULE_MAX_OCCURRENCES_DEFAULT,
  type EventOccurrence,
  type RRule,
  type RRuleFreq,
  type Weekday,
} from "./rrule.types";

const WEEKDAY_INDEX: Record<Weekday, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};
const WEEKDAY_FROM_INDEX: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Parse "RRULE:FREQ=...;INTERVAL=2;..." → RRule. Throws nếu invalid. */
export function parseRRule(line: string): RRule {
  if (!line) throw new Error("rrule empty");
  const stripped = line.startsWith("RRULE:") ? line.slice(6) : line;
  const parts = stripped.split(";").map((p) => p.trim()).filter(Boolean);
  const out: Partial<RRule> = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) throw new Error(`invalid rrule part: ${part}`);
    const key = part.slice(0, eq).toUpperCase();
    const val = part.slice(eq + 1);
    switch (key) {
      case "FREQ":
        if (!ALL_RRULE_FREQS.includes(val as RRuleFreq)) throw new Error(`invalid FREQ: ${val}`);
        out.freq = val as RRuleFreq;
        break;
      case "INTERVAL": {
        const n = Number.parseInt(val, 10);
        if (!Number.isFinite(n) || n < 1) throw new Error(`invalid INTERVAL: ${val}`);
        out.interval = n;
        break;
      }
      case "COUNT": {
        const n = Number.parseInt(val, 10);
        if (!Number.isFinite(n) || n < 1) throw new Error(`invalid COUNT: ${val}`);
        out.count = n;
        break;
      }
      case "UNTIL":
        if (!val) throw new Error("UNTIL empty");
        out.until = val;
        break;
      case "BYDAY": {
        const days = val.split(",").map((d) => d.trim().toUpperCase()) as Weekday[];
        for (const d of days) {
          if (!ALL_WEEKDAYS.includes(d)) throw new Error(`invalid BYDAY: ${d}`);
        }
        out.byDay = days;
        break;
      }
      case "BYMONTHDAY": {
        const days = val.split(",").map((d) => Number.parseInt(d.trim(), 10));
        for (const d of days) {
          if (!Number.isFinite(d) || d < -31 || d > 31 || d === 0) {
            throw new Error(`invalid BYMONTHDAY: ${d}`);
          }
        }
        out.byMonthDay = days;
        break;
      }
      case "BYMONTH": {
        const months = val.split(",").map((m) => Number.parseInt(m.trim(), 10));
        for (const m of months) {
          if (!Number.isFinite(m) || m < 1 || m > 12) throw new Error(`invalid BYMONTH: ${m}`);
        }
        out.byMonth = months;
        break;
      }
      case "WKST": {
        const d = val.toUpperCase() as Weekday;
        if (!ALL_WEEKDAYS.includes(d)) throw new Error(`invalid WKST: ${d}`);
        out.wkst = d;
        break;
      }
      default:
        throw new Error(`unsupported rrule key: ${key}`);
    }
  }
  if (!out.freq) throw new Error("FREQ required");
  return out as RRule;
}

export function serializeRRule(rule: RRule): string {
  const parts: string[] = [`FREQ=${rule.freq}`];
  if (rule.interval && rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${rule.until}`);
  if (rule.byDay && rule.byDay.length) parts.push(`BYDAY=${rule.byDay.join(",")}`);
  if (rule.byMonthDay && rule.byMonthDay.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(",")}`);
  if (rule.byMonth && rule.byMonth.length) parts.push(`BYMONTH=${rule.byMonth.join(",")}`);
  if (rule.wkst) parts.push(`WKST=${rule.wkst}`);
  return `RRULE:${parts.join(";")}`;
}

export interface GenerateOptions {
  /** Max number of occurrences to return. Default 90, hard cap 365. */
  maxOccurrences?: number;
  /** Upper bound date — generator stops nếu vượt quá. */
  horizonEnd?: string;
  /** Excluded dates (YYYY-MM-DD). */
  exDates?: string[];
  /** Series ID + event ID cho output. */
  seriesId: string;
  eventId: string;
}

/**
 * Generate next N occurrences bắt đầu từ `dtstart` (ISO).
 * Trả danh sách dates tăng dần.
 */
export function generateOccurrences(
  rule: RRule,
  dtstart: string,
  options: GenerateOptions,
): EventOccurrence[] {
  const maxOccurrences = Math.min(options.maxOccurrences ?? RRULE_MAX_OCCURRENCES_DEFAULT, RRULE_HARD_CAP);
  const horizonEnd = options.horizonEnd ? new Date(options.horizonEnd) : null;
  const exDates = new Set(options.exDates ?? []);
  const start = new Date(dtstart);
  if (Number.isNaN(start.getTime())) throw new Error(`invalid dtstart: ${dtstart}`);
  const interval = rule.interval ?? 1;
  const out: EventOccurrence[] = [];
  const seen = new Set<string>();

  const matchDay = (d: Date): boolean => {
    if (!rule.byDay || rule.byDay.length === 0) return true;
    const wd = WEEKDAY_FROM_INDEX[d.getUTCDay()];
    return rule.byDay.includes(wd);
  };
  const matchMonthDay = (d: Date): boolean => {
    if (!rule.byMonthDay || rule.byMonthDay.length === 0) return true;
    return rule.byMonthDay.includes(d.getUTCDate());
  };
  const matchMonth = (d: Date): boolean => {
    if (!rule.byMonth || rule.byMonth.length === 0) return true;
    return rule.byMonth.includes(d.getUTCMonth() + 1);
  };

  const advance = (d: Date, freqOccurrenceIndex: number): Date => {
    const next = new Date(d);
    switch (rule.freq) {
      case "DAILY":
        next.setUTCDate(next.getUTCDate() + interval);
        break;
      case "WEEKLY":
        next.setUTCDate(next.getUTCDate() + 7 * interval);
        break;
      case "MONTHLY":
        next.setUTCMonth(next.getUTCMonth() + interval);
        break;
      case "YEARLY":
        next.setUTCFullYear(next.getUTCFullYear() + interval);
        break;
    }
    return next;
  };

  let current = new Date(start);
  let safety = 0;
  while (out.length < maxOccurrences) {
    if (++safety > 10_000) throw new Error("rrule generator exceeded safety iteration cap");
    if (horizonEnd && current > horizonEnd) break;
    if (rule.until && current > new Date(rule.until)) break;
    if (rule.count !== undefined && out.length >= rule.count) break;

    if (matchesInterval(current, start, rule, interval) && matchDay(current) && matchMonthDay(current) && matchMonth(current)) {
      const ymd = toYMD(current);
      if (!seen.has(ymd)) {
        seen.add(ymd);
        if (!exDates.has(ymd)) {
          out.push({
            eventId: options.eventId,
            seriesId: options.seriesId,
            date: ymd,
            start: current.toISOString(),
            isException: false,
          });
        }
      }
    }

    current = stepForward(current, rule, interval);
  }
  return out;
}

/**
 * Check INTERVAL: khoảng cách từ dtstart phải là bội số của `interval` theo đơn vị FREQ.
 *   - DAILY:  floor((current - dtstart) / 86400000) % interval === 0
 *   - WEEKLY: floor((current - dtstart) / (7 * 86400000)) % interval === 0
 *   - MONTHLY: month diff % interval === 0 (same UTC day-of-month)
 *   - YEARLY:  year diff % interval === 0 (same UTC month/day)
 */
function matchesInterval(current: Date, start: Date, rule: RRule, interval: number): boolean {
  if (interval === 1) return true;
  switch (rule.freq) {
    case "DAILY": {
      const days = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
      return days >= 0 && days % interval === 0;
    }
    case "WEEKLY": {
      const weeks = Math.floor((current.getTime() - start.getTime()) / (7 * 86_400_000));
      return weeks >= 0 && weeks % interval === 0;
    }
    case "MONTHLY": {
      const months = (current.getUTCFullYear() - start.getUTCFullYear()) * 12 + (current.getUTCMonth() - start.getUTCMonth());
      return months >= 0 && months % interval === 0 && current.getUTCDate() === start.getUTCDate();
    }
    case "YEARLY": {
      const years = current.getUTCFullYear() - start.getUTCFullYear();
      return years >= 0 && years % interval === 0 && current.getUTCMonth() === start.getUTCMonth() && current.getUTCDate() === start.getUTCDate();
    }
  }
}

/**
 * Step forward by 1 day, rồi áp interval filter:
 * - DAILY: chỉ emit khi (daysSinceStart % interval === 0)
 * - WEEKLY: chỉ emit khi (weeksSinceStart % interval === 0)
 * - MONTHLY: chỉ emit khi (monthsSinceStart % interval === 0) — measured by month diff
 * - YEARLY: tương tự
 *
 * Approach: step 1 day, BYDAY/BYMONTHDAY/BYMONTH filter quyết định match.
 * INTERVAL được enforce bằng cách skip đến lần xuất hiện thứ `interval` trong cycle.
 *
 * Cho MVP: ta giả định INTERVAL áp dụng đơn giản: DAILY step `interval` days,
 * WEEKLY step `7*interval` days (BYDAY chỉ áp dụng khi không có INTERVAL để
 * đơn giản hóa). Implementation phức tạp hơn (RFC 5545 fully conformant) sẽ ở
 * Phase 10+ khi cần edge case (e.g. INTERVAL=2 + BYDAY=MO,WE).
 */
function stepForward(d: Date, rule: RRule, interval: number): Date {
  const next = new Date(d);
  switch (rule.freq) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + interval);
      break;
    case "WEEKLY":
      // Step 1 day để quét mọi weekday trong tuần.
      // INTERVAL=1: hàng tuần. INTERVAL=2: cách tuần (mỗi tuần thứ 2).
      // Để support cả hai, ta step 1 day rồi check week index.
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "MONTHLY":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "YEARLY":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
  }
  return next;
}

export function toYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Validate a full RRule structure (semantic — complement of parseRRule). */
export function validateRRule(rule: RRule): { ok: true } | { ok: false; reason: string } {
  if (rule.count !== undefined && rule.until !== undefined) {
    return { ok: false, reason: "count and until are mutually exclusive" };
  }
  if (rule.byDay && rule.byDay.length > 0 && rule.freq !== "WEEKLY") {
    return { ok: false, reason: "BYDAY chỉ hợp lệ với FREQ=WEEKLY" };
  }
  if (rule.byMonthDay && rule.byMonthDay.length > 0 && rule.freq !== "MONTHLY") {
    return { ok: false, reason: "BYMONTHDAY chỉ hợp lệ với FREQ=MONTHLY" };
  }
  if (rule.byMonth && rule.byMonth.length > 0 && rule.freq !== "YEARLY") {
    return { ok: false, reason: "BYMONTH chỉ hợp lệ với FREQ=YEARLY" };
  }
  if (rule.interval !== undefined && rule.interval < 1) {
    return { ok: false, reason: "INTERVAL phải ≥ 1" };
  }
  if (rule.count !== undefined && rule.count < 1) {
    return { ok: false, reason: "COUNT phải ≥ 1" };
  }
  return { ok: true };
}
