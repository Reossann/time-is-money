import { describe, expect, it } from "vitest";

import { formatTime } from "./activityService";

describe("formatTime", () => {
  it.each([
    [0, "00:00:00"],
    [61, "00:01:01"],
    [3661, "01:01:01"],
    [1.9, "00:00:01"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid seconds: %s",
    (seconds) => {
      expect(() => formatTime(seconds)).toThrow();
    },
  );
});
