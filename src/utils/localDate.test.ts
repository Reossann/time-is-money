import { describe, expect, it } from "vitest";

import { LocalDateError, toLocalDateKey } from "./localDate";

describe("toLocalDateKey", () => {
  it("derives the local calendar day in YYYY-MM-DD", () => {
    const local = new Date(2026, 0, 15, 10, 30, 0);
    expect(toLocalDateKey(local.getTime())).toBe("2026-01-15");
  });

  it("zero-pads single digit month and day", () => {
    const local = new Date(2026, 8, 3, 0, 0, 0);
    expect(toLocalDateKey(local.getTime())).toBe("2026-09-03");
  });

  it("keeps a late-evening timestamp on the same local day", () => {
    const local = new Date(2026, 2, 1, 23, 59, 59);
    expect(toLocalDateKey(local.getTime())).toBe("2026-03-01");
  });

  it("keeps a just-after-midnight timestamp on the new local day", () => {
    const local = new Date(2026, 2, 2, 0, 0, 1);
    expect(toLocalDateKey(local.getTime())).toBe("2026-03-02");
  });

  it("handles a day around a spring-forward DST boundary", () => {
    // 2026-03-08 is the US spring-forward date; the calendar day is unaffected.
    const local = new Date(2026, 2, 8, 3, 30, 0);
    expect(toLocalDateKey(local.getTime())).toBe("2026-03-08");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the invalid epoch value %p",
    (value) => {
      expect(() => toLocalDateKey(value)).toThrow(LocalDateError);
    },
  );
});
