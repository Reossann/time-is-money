export type CalendarDate = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

type ZonedDateTime = CalendarDate &
  Readonly<{
    hour: number;
    minute: number;
    second: number;
  }>;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZoneId: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZoneId);
  if (cached !== undefined) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZoneId,
    calendar: "iso8601",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatterCache.set(timeZoneId, formatter);
  return formatter;
}

function readPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) throw new Error(`missing date part: ${type}`);
  return Number(value);
}

/** Reads an instant as calendar fields in the supplied IANA timezone. */
export function toZonedDateTime(epochMs: number, timeZoneId: string): ZonedDateTime {
  const parts = getFormatter(timeZoneId).formatToParts(new Date(epochMs));
  return Object.freeze({
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hour: readPart(parts, "hour"),
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second"),
  });
}

export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return Object.freeze({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

export function startOfCalendarMonth(date: CalendarDate): CalendarDate {
  return Object.freeze({ year: date.year, month: date.month, day: 1 });
}

export function addCalendarMonths(date: CalendarDate, months: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  return Object.freeze({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: 1,
  });
}

export function formatCalendarDate(date: CalendarDate): string {
  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

export function formatCalendarMonth(date: CalendarDate): string {
  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}`;
}

/** Monday is 0 and Sunday is 6. This uses Gregorian calendar math, not host time. */
export function getIsoWeekday(date: CalendarDate): number {
  return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
}

export function startOfIsoWeek(date: CalendarDate): CalendarDate {
  return addCalendarDays(date, -getIsoWeekday(date));
}

export function formatIsoWeekKey(date: CalendarDate): string {
  const weekStart = startOfIsoWeek(date);
  const thursday = addCalendarDays(weekStart, 3);
  const weekYear = thursday.year;
  const firstWeek = startOfIsoWeek({ year: weekYear, month: 1, day: 4 });
  const weekNumber =
    Math.floor(
      (Date.UTC(weekStart.year, weekStart.month - 1, weekStart.day) -
        Date.UTC(firstWeek.year, firstWeek.month - 1, firstWeek.day)) /
        604_800_000,
    ) + 1;
  return `${weekYear.toString().padStart(4, "0")}-W${weekNumber
    .toString()
    .padStart(2, "0")}`;
}

function offsetAt(epochMs: number, timeZoneId: string): number {
  const zoned = toZonedDateTime(epochMs, timeZoneId);
  const roundedEpochMs = Math.floor(epochMs / 1_000) * 1_000;
  return (
    Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    ) - roundedEpochMs
  );
}

/**
 * Converts a local calendar midnight to UTC. The second offset lookup handles
 * a daylight-saving transition without relying on the host timezone.
 */
export function calendarDateStartToUtc(date: CalendarDate, timeZoneId: string): number {
  const localAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  const firstCandidate = localAsUtc - offsetAt(localAsUtc, timeZoneId);
  return localAsUtc - offsetAt(firstCandidate, timeZoneId);
}
