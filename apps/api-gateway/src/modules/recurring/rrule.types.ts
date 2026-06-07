/**
 * apps/api-gateway/src/modules/recurring/rrule.types.ts
 *
 * I-904 — Recurring events types.
 *
 * Recurrence rules: subset RFC 5545 RRULE (không cần full implementation,
 * MVP support các pattern phổ biến). Pure types — không phụ thuộc NestJS.
 *
 * Supported FREQ: DAILY, WEEKLY, MONTHLY, YEARLY.
 * Supported BY*: BYDAY (WEEKLY), BYMONTHDAY (MONTHLY), BYMONTH (YEARLY).
 * Supported INTERVAL: positive integer ≥ 1.
 * Supported UNTIL / COUNT: mutually exclusive.
 *
 * Out of scope (Phase 10+): BYHOUR, BYMINUTE, BYSECOND, BYWEEKNO, BYYEARDAY,
 * BYSETPOS, WKST, complex exception rules (EXDATE/EXRULE).
 */
export type RRuleFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface RRule {
  freq: RRuleFreq;
  interval?: number;
  count?: number;
  until?: string; // ISO 8601
  /** WEEKLY only. */
  byDay?: Weekday[];
  /** MONTHLY only. */
  byMonthDay?: number[];
  /** YEARLY only. */
  byMonth?: number[];
  /** Defaults to "SU" (Sunday) — không dùng cho freq≠WEEKLY. */
  wkst?: Weekday;
}

export const ALL_RRULE_FREQS: readonly RRuleFreq[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
export const ALL_WEEKDAYS: readonly Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export const RRULE_MAX_OCCURRENCES_DEFAULT = 90; // generate 90 ngày tới
export const RRULE_HARD_CAP = 365; // safety cap (1 năm)

/**
 * Event occurrence metadata.
 *   - `date`: local date YYYY-MM-DD của occurrence
 *   - `start`: ISO 8601 datetime (UTC) của occurrence
 *   - `eventId`: parent event ID
 *   - `seriesId`: parent series ID
 *   - `isException`: true nếu nằm trong EXDATE list
 */
export interface EventOccurrence {
  eventId: string;
  seriesId: string;
  date: string; // YYYY-MM-DD
  start: string; // ISO
  isException: boolean;
}

export interface EventSeries {
  id: string;
  tenantId: string;
  name: string;
  /** Event template — occurrences share các fields này (slug, venue, ...). */
  templateEventId: string;
  rule: RRule;
  /** Local start time (HH:MM) áp cho mọi occurrence. */
  startTimeLocal: string;
  /** Duration in minutes. */
  durationMinutes: number;
  /** Timezone IANA (vd "Asia/Ho_Chi_Minh"). */
  timezone: string;
  /** Excluded dates — ISO date YYYY-MM-DD. */
  exDates: string[];
  /** Pre-generated cache (next N occurrences). */
  occurrences?: EventOccurrence[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventSeriesInput {
  name: string;
  templateEventId: string;
  rule: RRule;
  startTimeLocal: string;
  durationMinutes: number;
  timezone: string;
  exDates?: string[];
}

export const RRULE_VALIDATION = {
  nameMaxLength: 200,
  timePattern: /^([01]\d|2[0-3]):[0-5]\d$/,
  durationMinMinutes: 5,
  durationMaxMinutes: 60 * 24 * 7, // 1 tuần
  timezonePattern: /^[A-Z][A-Za-z0-9_+/.-]*$/, // rough IANA check
};
