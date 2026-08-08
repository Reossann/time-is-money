export class LocalDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalDateError";
  }
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/**
 * Converts an epoch-milliseconds timestamp to a local-timezone calendar day key
 * in "YYYY-MM-DD" form. The epoch value remains the source of truth; the day key
 * is derived with the host local timezone so calendar grouping matches the day
 * the user actually saw on screen. Daylight-saving shifts do not affect the
 * result because the calendar fields are read through the local Date accessors.
 */
export function toLocalDateKey(epochMs: number): string {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) {
    throw new LocalDateError("epochMs must be a non-negative safe integer");
  }

  const date = new Date(epochMs);
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}
